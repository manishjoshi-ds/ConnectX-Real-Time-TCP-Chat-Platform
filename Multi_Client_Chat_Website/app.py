"""
Multi-Client Chat Application Using TCP (Flask + Flask-SocketIO + SQLite)
Full-featured real-time communication platform over WebSocket/TCP with:
- SQLite persistence (users, conversations, conversation_members, messages, media_files, message_reactions)
- HTTP multipart uploads & authorized streaming/download routes
- Public rooms, 1-to-1 private messaging, and group chats
- Profiles, avatars, typing indicators, read receipts, replies, edit/delete, reactions, and keyword search
"""

from datetime import datetime
import json
import os
import re
import sqlite3
import threading
import uuid

from flask import Flask, Response, abort, jsonify, render_template, request, send_file
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "tcpchat.db")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
MEDIA_DIR = os.path.join(UPLOADS_DIR, "media")
AVATARS_DIR = os.path.join(UPLOADS_DIR, "avatars")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(AVATARS_DIR, exist_ok=True)

app = Flask(__name__)
app.config["SECRET_KEY"] = "tcp-chat-dev-secret-key"
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB ceiling

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

state_lock = threading.Lock()
active_sessions = {}  # sid -> {sid, user_id, username, normalized, auth_token, joined_at}
token_to_session = {}  # auth_token -> session

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_ -]{2,24}$")
AVATAR_COLORS = ["#4F46E5", "#0284C7", "#059669", "#D97706", "#DB2777", "#7C3AED"]

MEDIA_RULES = {
    "image": {"exts": {".jpg", ".jpeg", ".png", ".webp"}, "mimes": {"image/jpeg", "image/png", "image/webp"}, "max_mb": 10},
    "video": {"exts": {".mp4", ".webm"}, "mimes": {"video/mp4", "video/webm"}, "max_mb": 50},
    "document": {
        "exts": {".pdf", ".doc", ".docx", ".txt", ".ppt", ".pptx", ".xls", ".xlsx"},
        "mimes": {
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream",
        },
        "max_mb": 20,
    },
    "audio": {
        "exts": {".mp3", ".wav", ".ogg", ".m4a", ".webm"},
        "mimes": {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg", "audio/mp4", "audio/webm", "video/webm"},
        "max_mb": 20,
    },
    "avatar": {"exts": {".jpg", ".jpeg", ".png", ".webp"}, "mimes": {"image/jpeg", "image/png", "image/webp"}, "max_mb": 5},
}


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    conn = get_db()
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                normalized_username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                bio TEXT NOT NULL DEFAULT '',
                status_text TEXT NOT NULL DEFAULT 'Available',
                presence TEXT NOT NULL DEFAULT 'online',
                avatar_id TEXT NULL,
                avatar_color TEXT NOT NULL,
                last_active TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                avatar_id TEXT NULL,
                created_by TEXT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS conversation_members (
                conversation_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                joined_at TEXT NOT NULL,
                last_read_at TEXT NULL,
                PRIMARY KEY (conversation_id, user_id),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS media_files (
                id TEXT PRIMARY KEY,
                stored_filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                media_type TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                extension TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                duration_sec REAL NULL,
                conversation_id TEXT NOT NULL,
                uploader_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                sender_username TEXT NOT NULL,
                msg_type TEXT NOT NULL,
                text TEXT NOT NULL DEFAULT '',
                media_id TEXT NULL,
                reply_to_id TEXT NULL,
                reply_preview_sender TEXT NULL,
                reply_preview_text TEXT NULL,
                edited INTEGER NOT NULL DEFAULT 0,
                deleted INTEGER NOT NULL DEFAULT 0,
                delivery_status TEXT NOT NULL DEFAULT 'sent',
                read_by_json TEXT NOT NULL DEFAULT '[]',
                pinned INTEGER NOT NULL DEFAULT 0,
                pinned_by TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS message_reactions (
                message_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                emoji TEXT NOT NULL,
                PRIMARY KEY (message_id, user_id, emoji),
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
            );
            """
        )
        msg_cols = {r[1] for r in conn.execute("PRAGMA table_info(messages)").fetchall()}
        if "pinned" not in msg_cols:
            conn.execute("ALTER TABLE messages ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
        if "pinned_by" not in msg_cols:
            conn.execute("ALTER TABLE messages ADD COLUMN pinned_by TEXT NULL")
        conn.execute(
            """INSERT OR IGNORE INTO conversations (id, type, name, description, avatar_id, created_by, created_at)
               VALUES ('public', 'public', 'Common Chat Room', 'Public TCP broadcast channel', NULL, 'system', ?)""",
            (iso_now(),),
        )
    conn.close()


def iso_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def clock_time(iso_str: str | None = None) -> str:
    if not iso_str:
        return datetime.now().strftime("%H:%M:%S")
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", ""))
        return dt.strftime("%H:%M:%S")
    except ValueError:
        return datetime.now().strftime("%H:%M:%S")


def pick_color(seed: str) -> str:
    total = sum(ord(c) for c in seed)
    return AVATAR_COLORS[total % len(AVATAR_COLORS)]


def online_user_ids_locked() -> set[str]:
    return {s["user_id"] for s in active_sessions.values()}


def get_sessions_for_user_locked(user_id: str) -> list[dict]:
    return [s for s in active_sessions.values() if s["user_id"] == user_id]


def session_from_request() -> dict | None:
    token = request.headers.get("x-auth-token") or request.args.get("token", "")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    if not token:
        return None
    with state_lock:
        return token_to_session.get(token)


def validate_username(raw_name) -> tuple[bool, str, str]:
    if not isinstance(raw_name, str):
        return False, "", "Username must be a text value."
    cleaned = " ".join(raw_name.strip().split())
    if not cleaned:
        return False, "", "Username cannot be empty."
    if len(cleaned) < 2 or len(cleaned) > 24:
        return False, "", "Username must be between 2 and 24 characters."
    if not USERNAME_PATTERN.match(cleaned):
        return False, "", "Username may only contain letters, numbers, spaces, hyphens, and underscores."
    return True, cleaned, ""


def validate_message(raw_text, allow_empty=False) -> tuple[bool, str, str]:
    if not isinstance(raw_text, str):
        return (True, "", "") if allow_empty else (False, "", "Message must be text.")
    cleaned = raw_text.strip()
    if not cleaned and not allow_empty:
        return False, "", "Cannot send an empty message."
    if len(cleaned) > 2000:
        return False, "", "Message cannot exceed 2000 characters."
    return True, cleaned, ""


def is_member(conn, conversation_id: str, user_id: str) -> bool:
    if conversation_id == "public":
        return True
    row = conn.execute(
        "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    return row is not None


def map_user(row, is_online: bool) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"] or row["username"],
        "bio": row["bio"] or "",
        "statusText": row["status_text"] or "Available",
        "presence": row["presence"] if is_online else "offline",
        "avatarUrl": f"/api/avatars/{row['avatar_id']}" if row["avatar_id"] else None,
        "avatarColor": row["avatar_color"],
        "isOnline": is_online,
        "lastActive": row["last_active"],
        "joinedAt": clock_time(row["last_active"]),
    }


def map_message(conn, row) -> dict:
    reactions_rows = conn.execute(
        "SELECT emoji, username FROM message_reactions WHERE message_id = ?", (row["id"],)
    ).fetchall()
    grouped = {}
    for rr in reactions_rows:
        grouped.setdefault(rr["emoji"], []).append(rr["username"])

    media = None
    if row["mf_id"] and not row["deleted"]:
        media = {
            "id": row["mf_id"],
            "originalFilename": row["mf_original_filename"],
            "mediaType": row["mf_media_type"],
            "mimeType": row["mf_mime_type"],
            "extension": row["mf_extension"],
            "sizeBytes": row["mf_size_bytes"],
            "durationSec": row["mf_duration_sec"],
            "url": f"/api/media/{row['mf_id']}",
            "downloadUrl": f"/api/media/{row['mf_id']}?download=1",
            "uploaderUsername": row["sender_username"],
            "createdAt": row["mf_created_at"],
        }

    reply_to = (
        {"id": row["reply_to_id"], "sender": row["reply_preview_sender"], "text": row["reply_preview_text"]}
        if row["reply_to_id"]
        else None
    )

    return {
        "id": row["id"],
        "conversationId": row["conversation_id"],
        "type": row["msg_type"],
        "senderId": row["sender_id"],
        "sender": row["sender_username"],
        "senderDisplayName": row["sender_display_name"] or row["sender_username"],
        "senderAvatarUrl": f"/api/avatars/{row['sender_avatar_id']}" if row["sender_avatar_id"] else None,
        "senderAvatarColor": row["sender_avatar_color"] or "#4F46E5",
        "text": row["text"],
        "media": media,
        "replyTo": reply_to,
        "reactions": [{"emoji": e, "users": u} for e, u in grouped.items()],
        "edited": bool(row["edited"]),
        "deleted": bool(row["deleted"]),
        "pinned": bool(row["pinned"]) if "pinned" in row.keys() else False,
        "pinnedBy": row["pinned_by"] if "pinned_by" in row.keys() else None,
        "deliveryStatus": row["delivery_status"],
        "readBy": json.loads(row["read_by_json"] or "[]"),
        "timestamp": clock_time(row["created_at"]),
        "createdAt": row["created_at"],
    }


def fetch_conversation_messages(conn, conversation_id: str, limit: int = 150) -> list[dict]:
    rows = conn.execute(
        """SELECT * FROM (
               SELECT m.*, u.display_name AS sender_display_name, u.avatar_id AS sender_avatar_id,
                      u.avatar_color AS sender_avatar_color,
                      mf.id AS mf_id, mf.original_filename AS mf_original_filename,
                      mf.media_type AS mf_media_type, mf.mime_type AS mf_mime_type,
                      mf.extension AS mf_extension, mf.size_bytes AS mf_size_bytes,
                      mf.duration_sec AS mf_duration_sec, mf.created_at AS mf_created_at
               FROM messages m
               LEFT JOIN users u ON u.id = m.sender_id
               LEFT JOIN media_files mf ON mf.id = m.media_id
               WHERE m.conversation_id = ?
               ORDER BY m.created_at DESC LIMIT ?
           ) sub ORDER BY created_at ASC""",
        (conversation_id, limit),
    ).fetchall()
    return [map_message(conn, r) for r in rows]


def fetch_conversation_summary(conn, conv_id: str, viewer_id: str, online_ids: set[str]) -> dict | None:
    row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    if not row:
        return None
    members_rows = conn.execute(
        """SELECT u.*, cm.role FROM conversation_members cm
           INNER JOIN users u ON u.id = cm.user_id
           WHERE cm.conversation_id = ? ORDER BY cm.role ASC, u.username ASC""",
        (conv_id,),
    ).fetchall()
    members = [
        {
            "userId": m["id"],
            "username": m["username"],
            "displayName": m["display_name"],
            "avatarUrl": f"/api/avatars/{m['avatar_id']}" if m["avatar_id"] else None,
            "avatarColor": m["avatar_color"],
            "role": m["role"],
            "isOnline": m["id"] in online_ids,
            "presence": m["presence"] if m["id"] in online_ids else "offline",
            "lastActive": m["last_active"],
        }
        for m in members_rows
    ]
    display_name = row["name"]
    avatar_url = f"/api/avatars/{row['avatar_id']}" if row["avatar_id"] else None
    peer_info = {}
    if row["type"] == "private":
        peer = next((m for m in members if m["userId"] != viewer_id), members[0] if members else None)
        if peer:
            display_name = peer["displayName"]
            avatar_url = peer["avatarUrl"]
            peer_info = {
                "peerUsername": peer["username"],
                "peerPresence": peer["presence"],
                "peerIsOnline": peer["isOnline"],
                "peerLastActive": peer["lastActive"],
            }
    return {
        "id": row["id"],
        "type": row["type"],
        "name": display_name,
        "description": row["description"],
        "avatarUrl": avatar_url,
        "members": members,
        "unreadCount": 0,
        **peer_info,
    }


def detect_media(filename: str, mime: str, size_bytes: int, requested_cat: str | None = None):
    ext = os.path.splitext(filename or "")[1].lower()
    norm_mime = (mime or "").lower().split(";")[0].strip()
    if not ext:
        return False, None, None, "File must have an extension."

    cat = requested_cat if requested_cat in MEDIA_RULES else None
    if not cat:
        for k in ("image", "video", "document", "audio"):
            if ext in MEDIA_RULES[k]["exts"]:
                cat = k
                break
    if not cat:
        return False, None, None, f'Unsupported file extension "{ext}".'

    rule = MEDIA_RULES[cat]
    if ext not in rule["exts"]:
        return False, None, None, f'Extension "{ext}" is not allowed for {cat}.'
    if norm_mime and norm_mime not in rule["mimes"]:
        return False, None, None, f'MIME type "{norm_mime}" is not allowed for {cat}.'
    if size_bytes <= 0 or size_bytes > rule["max_mb"] * 1024 * 1024:
        return False, None, None, f'File size must be between 1 byte and {rule["max_mb"]} MB.'
    return True, cat, ext, ""


init_db()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat")
def chat():
    return render_template("chat.html")


@app.route("/api/status")
def status():
    with state_lock:
        count = len(online_user_ids_locked())
    return jsonify({"status": "running", "onlineUsers": count, "transport": "WebSocket/TCP", "database": "SQLite"})


@app.route("/api/upload", methods=["POST"])
def api_upload():
    session = session_from_request()
    if not session:
        return jsonify({"error": "Unauthorized"}), 401
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No file attached."}), 400

    conv_id = request.form.get("conversationId", "public").strip()
    conn = get_db()
    if not is_member(conn, conv_id, session["user_id"]):
        conn.close()
        return jsonify({"error": "Access denied for this conversation."}), 403

    file.seek(0, os.SEEK_END)
    size_bytes = file.tell()
    file.seek(0)
    ok, cat, ext, err = detect_media(file.filename, file.mimetype, size_bytes, request.form.get("category"))
    if not ok or cat == "avatar":
        conn.close()
        return jsonify({"error": err or "Invalid media file."}), 400

    file_id = str(uuid.uuid4())
    stored = f"{file_id}{ext}"
    safe_orig = secure_filename(file.filename) or f"file{ext}"
    file.save(os.path.join(MEDIA_DIR, stored))

    duration = request.form.get("durationSec", type=float)
    with conn:
        conn.execute(
            """INSERT INTO media_files (id, stored_filename, original_filename, media_type, mime_type, extension, size_bytes, duration_sec, conversation_id, uploader_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (file_id, stored, safe_orig, cat, file.mimetype or "application/octet-stream", ext.lstrip(".").upper(), size_bytes, duration, conv_id, session["user_id"], iso_now()),
        )
    conn.close()
    return jsonify(
        {
            "media": {
                "id": file_id,
                "originalFilename": safe_orig,
                "mediaType": cat,
                "mimeType": file.mimetype or "application/octet-stream",
                "extension": ext.lstrip(".").upper(),
                "sizeBytes": size_bytes,
                "durationSec": duration,
                "url": f"/api/media/{file_id}",
                "downloadUrl": f"/api/media/{file_id}?download=1",
                "uploaderUsername": session["username"],
                "createdAt": iso_now(),
            }
        }
    ), 201


@app.route("/api/upload-avatar", methods=["POST"])
def api_upload_avatar():
    session = session_from_request()
    if not session:
        return jsonify({"error": "Unauthorized"}), 401
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No image provided."}), 400

    file.seek(0, os.SEEK_END)
    size_bytes = file.tell()
    file.seek(0)
    ok, _, ext, err = detect_media(file.filename, file.mimetype, size_bytes, "avatar")
    if not ok:
        return jsonify({"error": err}), 400

    file_id = str(uuid.uuid4())
    stored = f"{file_id}{ext}"
    file.save(os.path.join(AVATARS_DIR, stored))
    conn = get_db()
    with conn:
        conn.execute(
            """INSERT INTO media_files (id, stored_filename, original_filename, media_type, mime_type, extension, size_bytes, duration_sec, conversation_id, uploader_id, created_at)
               VALUES (?, ?, ?, 'avatar', ?, ?, ?, NULL, 'public', ?, ?)""",
            (file_id, stored, secure_filename(file.filename), file.mimetype or "image/png", ext.lstrip(".").upper(), size_bytes, session["user_id"], iso_now()),
        )
        conn.execute("UPDATE users SET avatar_id = ? WHERE id = ?", (file_id, session["user_id"]))
    conn.close()
    return jsonify({"avatarId": file_id, "avatarUrl": f"/api/avatars/{file_id}"}), 201


@app.route("/api/media/<file_id>")
def api_get_media(file_id: str):
    session = session_from_request()
    if not session:
        abort(401)
    conn = get_db()
    rec = conn.execute("SELECT * FROM media_files WHERE id = ?", (file_id,)).fetchone()
    if not rec or rec["media_type"] == "avatar":
        conn.close()
        abort(404)
    if not is_member(conn, rec["conversation_id"], session["user_id"]):
        conn.close()
        abort(403)
    conn.close()

    safe_name = os.path.basename(rec["stored_filename"])
    full_path = os.path.join(MEDIA_DIR, safe_name)
    if not os.path.exists(full_path):
        abort(404)

    as_attachment = request.args.get("download") == "1"
    return send_file(full_path, mimetype=rec["mime_type"], as_attachment=as_attachment, download_name=rec["original_filename"])


@app.route("/api/avatars/<file_id>")
def api_get_avatar(file_id: str):
    conn = get_db()
    rec = conn.execute("SELECT * FROM media_files WHERE id = ? AND media_type = 'avatar'", (file_id,)).fetchone()
    conn.close()
    if not rec:
        abort(404)
    full_path = os.path.join(AVATARS_DIR, os.path.basename(rec["stored_filename"]))
    if not os.path.exists(full_path):
        abort(404)
    return send_file(full_path, mimetype=rec["mime_type"])


@app.route("/api/conversations/<conv_id>/messages")
def api_conv_messages(conv_id: str):
    session = session_from_request()
    if not session:
        return jsonify({"error": "Unauthorized"}), 401
    conn = get_db()
    if not is_member(conn, conv_id, session["user_id"]):
        conn.close()
        return jsonify({"error": "Forbidden"}), 403
    msgs = fetch_conversation_messages(conn, conv_id)
    conn.close()
    return jsonify({"messages": msgs})


@app.route("/api/conversations/<conv_id>/media")
def api_conv_media(conv_id: str):
    session = session_from_request()
    if not session:
        return jsonify({"error": "Unauthorized"}), 401
    conn = get_db()
    if not is_member(conn, conv_id, session["user_id"]):
        conn.close()
        return jsonify({"error": "Forbidden"}), 403
    rows = conn.execute(
        """SELECT mf.*, u.username AS uploader_username FROM media_files mf
           LEFT JOIN users u ON u.id = mf.uploader_id
           INNER JOIN messages m ON m.media_id = mf.id
           WHERE mf.conversation_id = ? AND m.deleted = 0 ORDER BY mf.created_at DESC""",
        (conv_id,),
    ).fetchall()
    conn.close()
    media = [
        {
            "id": r["id"],
            "originalFilename": r["original_filename"],
            "mediaType": r["media_type"],
            "mimeType": r["mime_type"],
            "extension": r["extension"],
            "sizeBytes": r["size_bytes"],
            "durationSec": r["duration_sec"],
            "url": f"/api/media/{r['id']}",
            "downloadUrl": f"/api/media/{r['id']}?download=1",
            "uploaderUsername": r["uploader_username"] or "User",
            "createdAt": r["created_at"],
        }
        for r in rows
    ]
    return jsonify({"media": media})


@app.route("/api/conversations/<conv_id>/search")
def api_conv_search(conv_id: str):
    session = session_from_request()
    if not session:
        return jsonify({"error": "Unauthorized"}), 401
    q = f"%{request.args.get('q', '').strip()}%"
    conn = get_db()
    if not is_member(conn, conv_id, session["user_id"]):
        conn.close()
        return jsonify({"error": "Forbidden"}), 403
    rows = conn.execute(
        """SELECT m.*, u.display_name AS sender_display_name, u.avatar_id AS sender_avatar_id,
                  u.avatar_color AS sender_avatar_color,
                  mf.id AS mf_id, mf.original_filename AS mf_original_filename,
                  mf.media_type AS mf_media_type, mf.mime_type AS mf_mime_type,
                  mf.extension AS mf_extension, mf.size_bytes AS mf_size_bytes,
                  mf.duration_sec AS mf_duration_sec, mf.created_at AS mf_created_at
           FROM messages m LEFT JOIN users u ON u.id = m.sender_id
           LEFT JOIN media_files mf ON mf.id = m.media_id
           WHERE m.conversation_id = ? AND m.deleted = 0
             AND (m.text LIKE ? OR mf.original_filename LIKE ? OR m.sender_username LIKE ?)
           ORDER BY m.created_at DESC LIMIT 50""",
        (conv_id, q, q, q),
    ).fetchall()
    results = [map_message(conn, r) for r in rows]
    conn.close()
    return jsonify({"results": results})


@socketio.on("connect")
def handle_connect():
    with state_lock:
        count = len(online_user_ids_locked())
    emit("server_info", {"onlineCount": count, "sid": request.sid})


@socketio.on("join_chat")
def handle_join(data):
    sid = request.sid
    ok, username, err = validate_username((data or {}).get("username", ""))
    if not ok:
        emit("join_error", {"message": err})
        return

    norm = username.lower()
    with state_lock:
        old = active_sessions.pop(sid, None)
        if old:
            token_to_session.pop(old["auth_token"], None)
        for existing in active_sessions.values():
            if existing["normalized"] == norm:
                emit("join_error", {"message": f'Username "{username}" is already active in the room.'})
                return

    conn = get_db()
    now = iso_now()
    with conn:
        user_row = conn.execute("SELECT * FROM users WHERE normalized_username = ?", (norm,)).fetchone()
        if user_row:
            user_id = user_row["id"]
            conn.execute("UPDATE users SET username = ?, presence = 'online', last_active = ? WHERE id = ?", (username, now, user_id))
        else:
            user_id = str(uuid.uuid4())
            conn.execute(
                """INSERT INTO users (id, username, normalized_username, display_name, bio, status_text, presence, avatar_id, avatar_color, last_active, created_at)
                   VALUES (?, ?, ?, ?, '', 'Available', 'online', NULL, ?, ?, ?)""",
                (user_id, username, norm, username, pick_color(norm), now, now),
            )
        conn.execute(
            "INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at) VALUES ('public', ?, 'member', ?, ?)",
            (user_id, now, now),
        )
        msg_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO messages (id, conversation_id, sender_id, sender_username, msg_type, text, delivery_status, read_by_json, created_at)
               VALUES (?, 'public', 'system', 'Server', 'system', ?, 'read', '[]', ?)""",
            (msg_id, f"{username} joined the chat room.", now),
        )

    auth_token = str(uuid.uuid4())
    with state_lock:
        session = {
            "sid": sid,
            "user_id": user_id,
            "username": username,
            "normalized": norm,
            "auth_token": auth_token,
            "joined_at": clock_time(now),
        }
        active_sessions[sid] = session
        token_to_session[auth_token] = session
        online_ids = online_user_ids_locked()

    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    profile = map_user(user_row, True)
    all_users = [map_user(r, r["id"] in online_ids) for r in conn.execute("SELECT * FROM users ORDER BY last_active DESC").fetchall()]
    conv_rows = conn.execute(
        "SELECT c.id FROM conversations c INNER JOIN conversation_members cm ON c.id = cm.conversation_id WHERE cm.user_id = ?",
        (user_id,),
    ).fetchall()
    convs = [fetch_conversation_summary(conn, cr["id"], user_id, online_ids) for cr in conv_rows]
    history = fetch_conversation_messages(conn, "public")
    join_msg = fetch_conversation_messages(conn, "public", 1)[-1]
    conn.close()

    emit(
        "join_success",
        {
            "username": username,
            "userId": user_id,
            "sid": sid,
            "authToken": auth_token,
            "profile": profile,
            "users": [u for u in all_users if u["isOnline"]],
            "directory": all_users,
            "conversations": [c for c in convs if c],
            "activeConversationId": "public",
            "history": history,
        },
    )
    emit("new_message", {"message": join_msg}, broadcast=True, include_self=False)
    emit("users_update", {"users": [u for u in all_users if u["isOnline"]], "directory": all_users}, broadcast=True)


@socketio.on("send_message")
def handle_send_message(data):
    with state_lock:
        session = active_sessions.get(request.sid)
        online_ids = online_user_ids_locked()
    if not session:
        emit("chat_error", {"message": "Please join the chat first."})
        return

    payload = data or {}
    conv_id = str(payload.get("conversationId", "public")).strip()
    media_id = str(payload.get("mediaId", "") or "").strip() or None
    reply_to_id = str(payload.get("replyToId", "") or "").strip() or None
    ok, text, err = validate_message(payload.get("text", ""), allow_empty=bool(media_id))
    if not ok:
        emit("chat_error", {"message": err})
        return

    conn = get_db()
    if not is_member(conn, conv_id, session["user_id"]):
        conn.close()
        emit("chat_error", {"message": "Not a member of this conversation."})
        return

    msg_id = str(uuid.uuid4())
    now = iso_now()
    reply_sender, reply_text = None, None
    if reply_to_id:
        rrow = conn.execute("SELECT sender_username, text FROM messages WHERE id = ?", (reply_to_id,)).fetchone()
        if rrow:
            reply_sender = rrow["sender_username"]
            reply_text = rrow["text"][:120]

    with conn:
        conn.execute(
            """INSERT INTO messages (id, conversation_id, sender_id, sender_username, msg_type, text, media_id, reply_to_id, reply_preview_sender, reply_preview_text, delivery_status, read_by_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'delivered', ?, ?)""",
            (msg_id, conv_id, session["user_id"], session["username"], "media" if media_id else "text", text, media_id, reply_to_id, reply_sender, reply_text, json.dumps([session["username"]]), now),
        )
        member_rows = conn.execute("SELECT user_id FROM conversation_members WHERE conversation_id = ?", (conv_id,)).fetchall()

    msg = next((m for m in fetch_conversation_messages(conn, conv_id, 20) if m["id"] == msg_id), None)
    conn.close()
    if not msg:
        return

    if conv_id == "public":
        emit("new_message", {"message": msg}, broadcast=True)
    else:
        with state_lock:
            for mr in member_rows:
                for s in get_sessions_for_user_locked(mr["user_id"]):
                    emit("new_message", {"message": msg}, to=s["sid"])


@socketio.on("edit_message")
def handle_edit_message(data):
    with state_lock:
        session = active_sessions.get(request.sid)
    if not session:
        return
    msg_id = str((data or {}).get("messageId", ""))
    ok, text, err = validate_message((data or {}).get("text", ""))
    if not ok:
        emit("chat_error", {"message": err})
        return
    conn = get_db()
    row = conn.execute("SELECT * FROM messages WHERE id = ?", (msg_id,)).fetchone()
    if not row or row["sender_id"] != session["user_id"] or row["deleted"]:
        conn.close()
        return
    with conn:
        conn.execute("UPDATE messages SET text = ?, edited = 1, updated_at = ? WHERE id = ?", (text, iso_now(), msg_id))
    updated = next((m for m in fetch_conversation_messages(conn, row["conversation_id"], 50) if m["id"] == msg_id), None)
    conn.close()
    if updated:
        emit("message_updated", {"message": updated}, broadcast=True)


@socketio.on("delete_message")
def handle_delete_message(data):
    with state_lock:
        session = active_sessions.get(request.sid)
    if not session:
        return
    msg_id = str((data or {}).get("messageId", ""))
    conn = get_db()
    row = conn.execute("SELECT * FROM messages WHERE id = ?", (msg_id,)).fetchone()
    if not row or row["sender_id"] != session["user_id"]:
        conn.close()
        return
    with conn:
        conn.execute("UPDATE messages SET text = 'This message was deleted.', deleted = 1, media_id = NULL, updated_at = ? WHERE id = ?", (iso_now(), msg_id))
    updated = next((m for m in fetch_conversation_messages(conn, row["conversation_id"], 50) if m["id"] == msg_id), None)
    conn.close()
    if updated:
        emit("message_updated", {"message": updated}, broadcast=True)


@socketio.on("toggle_reaction")
def handle_reaction(data):
    with state_lock:
        session = active_sessions.get(request.sid)
    if not session:
        return
    msg_id = str((data or {}).get("messageId", ""))
    emoji = str((data or {}).get("emoji", "")).strip()[:8]
    if not msg_id or not emoji:
        return
    conn = get_db()
    msg_row = conn.execute("SELECT conversation_id FROM messages WHERE id = ?", (msg_id,)).fetchone()
    if not msg_row:
        conn.close()
        return
    with conn:
        exists = conn.execute(
            "SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
            (msg_id, session["user_id"], emoji),
        ).fetchone()
        if exists:
            conn.execute("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", (msg_id, session["user_id"], emoji))
        else:
            conn.execute("INSERT INTO message_reactions (message_id, user_id, username, emoji) VALUES (?, ?, ?, ?)", (msg_id, session["user_id"], session["username"], emoji))
    updated = next((m for m in fetch_conversation_messages(conn, msg_row["conversation_id"], 50) if m["id"] == msg_id), None)
    conn.close()
    if updated:
        emit("message_updated", {"message": updated}, broadcast=True)


@socketio.on("toggle_pin")
def handle_toggle_pin(data):
    with state_lock:
        session = active_sessions.get(request.sid)
    if not session:
        return
    msg_id = str((data or {}).get("messageId", ""))
    conn = get_db()
    row = conn.execute("SELECT conversation_id, pinned, deleted FROM messages WHERE id = ?", (msg_id,)).fetchone()
    if not row or row["deleted"]:
        conn.close()
        return
    next_pinned = 0 if row["pinned"] else 1
    pinned_by = session["username"] if next_pinned else None
    with conn:
        conn.execute("UPDATE messages SET pinned = ?, pinned_by = ? WHERE id = ?", (next_pinned, pinned_by, msg_id))
    updated = next((m for m in fetch_conversation_messages(conn, row["conversation_id"], 50) if m["id"] == msg_id), None)
    conn.close()
    if updated:
        emit("message_updated", {"message": updated}, broadcast=True)


@socketio.on("update_profile")
def handle_update_profile(data):
    with state_lock:
        session = active_sessions.get(request.sid)
        online_ids = online_user_ids_locked()
    if not session:
        return
    payload = data or {}
    display_name = str(payload.get("displayName", session["username"])).strip()[:32] or session["username"]
    bio = str(payload.get("bio", "")).strip()[:160]
    status_text = str(payload.get("statusText", "Available")).strip()[:48] or "Available"
    presence = str(payload.get("presence", "available"))
    if presence not in {"online", "available", "working", "busy", "gaming", "away"}:
        presence = "available"
    avatar_color = str(payload.get("avatarColor", "")).strip()
    conn = get_db()
    with conn:
        if re.match(r"^#[0-9A-Fa-f]{6}$", avatar_color):
            conn.execute(
                "UPDATE users SET display_name = ?, bio = ?, status_text = ?, presence = ?, avatar_color = ?, last_active = ? WHERE id = ?",
                (display_name, bio, status_text, presence, avatar_color, iso_now(), session["user_id"]),
            )
        else:
            conn.execute(
                "UPDATE users SET display_name = ?, bio = ?, status_text = ?, presence = ?, last_active = ? WHERE id = ?",
                (display_name, bio, status_text, presence, iso_now(), session["user_id"]),
            )
    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    profile = map_user(user_row, True)
    all_users = [map_user(r, r["id"] in online_ids) for r in conn.execute("SELECT * FROM users ORDER BY last_active DESC").fetchall()]
    conn.close()
    emit("profile_updated", {"profile": profile})
    emit("users_update", {"users": [u for u in all_users if u["isOnline"]], "directory": all_users}, broadcast=True)


@socketio.on("typing_state")
def handle_typing(data):
    with state_lock:
        session = active_sessions.get(request.sid)
    if not session:
        return
    conv_id = str((data or {}).get("conversationId", "public"))
    emit("typing_update", {"conversationId": conv_id, "username": session["username"], "isTyping": bool((data or {}).get("isTyping"))}, broadcast=True, include_self=False)


@socketio.on("mark_read")
def handle_mark_read(data):
    with state_lock:
        session = active_sessions.get(request.sid)
    if not session:
        return
    conv_id = str((data or {}).get("conversationId", ""))
    if not conv_id:
        return
    conn = get_db()
    rows = conn.execute(
        "SELECT id, read_by_json FROM messages WHERE conversation_id = ? AND sender_username != ? AND delivery_status != 'read'",
        (conv_id, session["username"]),
    ).fetchall()
    updated_ids = []
    with conn:
        for r in rows:
            rb = json.loads(r["read_by_json"] or "[]")
            if session["username"] not in rb:
                rb.append(session["username"])
            conn.execute("UPDATE messages SET delivery_status = 'read', read_by_json = ? WHERE id = ?", (json.dumps(rb), r["id"]))
            updated_ids.append(r["id"])
    conn.close()
    if updated_ids:
        emit("messages_read", {"conversationId": conv_id, "messageIds": updated_ids, "reader": session["username"]}, broadcast=True)


@socketio.on("open_dm")
def handle_open_dm(data):
    with state_lock:
        session = active_sessions.get(request.sid)
        online_ids = online_user_ids_locked()
    if not session:
        return
    target_name = str((data or {}).get("targetUsername", "")).strip()
    conn = get_db()
    target = conn.execute("SELECT * FROM users WHERE normalized_username = ?", (target_name.lower(),)).fetchone()
    if not target or target["id"] == session["user_id"]:
        conn.close()
        return
    pair = sorted([session["user_id"], target["id"]])
    conv_id = f"dm:{pair[0]}:{pair[1]}"
    now = iso_now()
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO conversations (id, type, name, description, created_by, created_at) VALUES (?, 'private', ?, 'Direct Chat', ?, ?)",
            (conv_id, f"{session['username']} & {target['username']}", session["user_id"], now),
        )
        conn.execute("INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)", (conv_id, session["user_id"], now))
        conn.execute("INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)", (conv_id, target["id"], now))
    summary = fetch_conversation_summary(conn, conv_id, session["user_id"], online_ids)
    msgs = fetch_conversation_messages(conn, conv_id)
    conn.close()
    emit("dm_opened", {"conversation": summary, "messages": msgs})


@socketio.on("create_group")
def handle_create_group(data):
    with state_lock:
        session = active_sessions.get(request.sid)
        online_ids = online_user_ids_locked()
    if not session:
        return
    payload = data or {}
    name = str(payload.get("name", "")).strip()
    if len(name) < 2:
        emit("chat_error", {"message": "Group name must be at least 2 characters."})
        return
    conv_id = f"grp:{uuid.uuid4()}"
    now = iso_now()
    conn = get_db()
    with conn:
        conn.execute(
            "INSERT INTO conversations (id, type, name, description, created_by, created_at) VALUES (?, 'group', ?, ?, ?, ?)",
            (conv_id, name[:40], str(payload.get("description", ""))[:120], session["user_id"], now),
        )
        conn.execute("INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)", (conv_id, session["user_id"], now))
        for uname in payload.get("memberUsernames", []):
            u = conn.execute("SELECT id FROM users WHERE normalized_username = ?", (str(uname).lower(),)).fetchone()
            if u and u["id"] != session["user_id"]:
                conn.execute("INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)", (conv_id, u["id"], now))
    summary = fetch_conversation_summary(conn, conv_id, session["user_id"], online_ids)
    conn.close()
    emit("conversation_updated", {"conversation": summary}, broadcast=True)
    emit("group_created", {"conversation": summary})


def remove_session(sid: str):
    with state_lock:
        removed = active_sessions.pop(sid, None)
        if not removed:
            return None
        token_to_session.pop(removed["auth_token"], None)
        still_online = any(s["user_id"] == removed["user_id"] for s in active_sessions.values())
        online_ids = online_user_ids_locked()

    if not still_online:
        conn = get_db()
        now = iso_now()
        msg_id = str(uuid.uuid4())
        with conn:
            conn.execute("UPDATE users SET presence = 'offline', last_active = ? WHERE id = ?", (now, removed["user_id"]))
            conn.execute(
                """INSERT INTO messages (id, conversation_id, sender_id, sender_username, msg_type, text, delivery_status, read_by_json, created_at)
                   VALUES (?, 'public', 'system', 'Server', 'system', ?, 'read', '[]', ?)""",
                (msg_id, f"{removed['username']} left the chat room.", now),
            )
        all_users = [map_user(r, r["id"] in online_ids) for r in conn.execute("SELECT * FROM users ORDER BY last_active DESC").fetchall()]
        leave_msg = fetch_conversation_messages(conn, "public", 1)[-1]
        conn.close()
        emit("new_message", {"message": leave_msg}, broadcast=True)
        emit("users_update", {"users": [u for u in all_users if u["isOnline"]], "directory": all_users}, broadcast=True)
    return removed


@socketio.on("logout")
def handle_logout():
    remove_session(request.sid)
    emit("logged_out", {"success": True})


@socketio.on("disconnect")
def handle_disconnect():
    remove_session(request.sid)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
