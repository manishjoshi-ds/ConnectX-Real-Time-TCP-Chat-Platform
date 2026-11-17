import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  ChatMessage,
  ConversationMember,
  ConversationSummary,
  MediaAttachment,
  MessageReaction,
  UserPresence,
  UserProfile,
} from '../src/types/chat.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'tcpchat.db');

const AVATAR_COLORS = [
  '#4F46E5',
  '#0284C7',
  '#059669',
  '#D97706',
  '#DB2777',
  '#7C3AED',
  '#0D9488',
  '#2563EB',
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function formatClockTime(isoOrDate?: string | Date): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toTimeString().slice(0, 8);
  }
  return d.toTimeString().slice(0, 8);
}

export function makeDmConversationId(userIdA: string, userIdB: string): string {
  const [first, second] = [userIdA, userIdB].sort();
  return `dm:${first}:${second}`;
}

export class ChatDatabase {
  private db: DatabaseSync;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.db = new DatabaseSync(DB_PATH);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
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

      CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_media_conv ON media_files(conversation_id, created_at);
    `);

    const msgCols = this.db.prepare('PRAGMA table_info(messages)').all() as { name: string }[];
    const msgColNames = new Set(msgCols.map((c) => c.name));
    if (!msgColNames.has('pinned')) {
      this.db.exec('ALTER TABLE messages ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;');
    }
    if (!msgColNames.has('pinned_by')) {
      this.db.exec('ALTER TABLE messages ADD COLUMN pinned_by TEXT NULL;');
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO conversations (id, type, name, description, avatar_id, created_by, created_at)
         VALUES ('public', 'public', 'Common Chat Room', 'Public TCP broadcast channel for all connected clients', NULL, 'system', ?)`,
      )
      .run(now);
  }

  upsertUserOnJoin(username: string, initialPresence: UserPresence = 'available'): UserProfile {
    const normalized = username.toLowerCase();
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT * FROM users WHERE normalized_username = ?')
      .get(normalized) as Record<string, unknown> | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE users SET username = ?, presence = ?, last_active = ? WHERE id = ?`,
        )
        .run(username, initialPresence, now, String(existing.id));

      this.ensureMembership('public', String(existing.id), 'member');
      return this.getUserById(String(existing.id), true)!;
    }

    const id = crypto.randomUUID();
    const color = pickAvatarColor(normalized);
    this.db
      .prepare(
        `INSERT INTO users (id, username, normalized_username, display_name, bio, status_text, presence, avatar_id, avatar_color, last_active, created_at)
         VALUES (?, ?, ?, ?, '', 'Available', ?, NULL, ?, ?, ?)`,
      )
      .run(id, username, normalized, username, initialPresence, color, now, now);

    this.ensureMembership('public', id, 'member');
    return this.getUserById(id, true)!;
  }

  getUserById(userId: string, isOnline = false): UserProfile | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return this.mapUserRow(row, isOnline);
  }

  getUserByUsername(username: string, isOnline = false): UserProfile | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE normalized_username = ?')
      .get(username.toLowerCase()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapUserRow(row, isOnline);
  }

  getAllUsers(onlineUserIds: Set<string>): UserProfile[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY last_active DESC')
      .all() as Record<string, unknown>[];
    return rows.map((row) => this.mapUserRow(row, onlineUserIds.has(String(row.id))));
  }

  updateUserProfile(
    userId: string,
    updates: {
      displayName?: string;
      bio?: string;
      statusText?: string;
      presence?: UserPresence;
      avatarId?: string | null;
      avatarColor?: string;
    },
  ): UserProfile | null {
    const current = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | Record<string, unknown>
      | undefined;
    if (!current) return null;

    const displayName = updates.displayName ?? String(current.display_name);
    const bio = updates.bio ?? String(current.bio);
    const statusText = updates.statusText ?? String(current.status_text);
    const presence = updates.presence ?? (String(current.presence) as UserPresence);
    const avatarId = updates.avatarId !== undefined ? updates.avatarId : (current.avatar_id as string | null);
    const avatarColor = updates.avatarColor ?? String(current.avatar_color);

    this.db
      .prepare(
        `UPDATE users SET display_name = ?, bio = ?, status_text = ?, presence = ?, avatar_id = ?, avatar_color = ?, last_active = ? WHERE id = ?`,
      )
      .run(
        displayName,
        bio,
        statusText,
        presence,
        avatarId,
        avatarColor,
        new Date().toISOString(),
        userId,
      );

    return this.getUserById(userId, true);
  }

  markUserOffline(userId: string) {
    this.db
      .prepare(`UPDATE users SET presence = 'offline', last_active = ? WHERE id = ?`)
      .run(new Date().toISOString(), userId);
  }

  touchUserActivity(userId: string) {
    this.db
      .prepare('UPDATE users SET last_active = ? WHERE id = ?')
      .run(new Date().toISOString(), userId);
  }

  ensureMembership(conversationId: string, userId: string, role: 'admin' | 'member' = 'member') {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, role, joined_at, last_read_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(conversationId, userId, role, now, now);
  }

  getOrCreateDmConversation(userA: UserProfile, userB: UserProfile): string {
    const convId = makeDmConversationId(userA.id, userB.id);
    const existing = this.db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
    if (!existing) {
      const now = new Date().toISOString();
      this.db
        .prepare(
          `INSERT INTO conversations (id, type, name, description, avatar_id, created_by, created_at)
           VALUES (?, 'private', ?, 'Private 1-to-1 TCP Conversation', NULL, ?, ?)`,
        )
        .run(convId, `${userA.username} & ${userB.username}`, userA.id, now);
    }
    this.ensureMembership(convId, userA.id, 'member');
    this.ensureMembership(convId, userB.id, 'member');
    return convId;
  }

  createGroupConversation(params: {
    name: string;
    description: string;
    creatorId: string;
    memberIds: string[];
    avatarId?: string | null;
  }): ConversationSummary {
    const convId = `grp:${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO conversations (id, type, name, description, avatar_id, created_by, created_at)
         VALUES (?, 'group', ?, ?, ?, ?, ?)`,
      )
      .run(convId, params.name, params.description, params.avatarId ?? null, params.creatorId, now);

    this.ensureMembership(convId, params.creatorId, 'admin');
    for (const memberId of params.memberIds) {
      if (memberId !== params.creatorId) {
        this.ensureMembership(convId, memberId, 'member');
      }
    }

    return this.getConversationSummary(convId, params.creatorId, new Set([params.creatorId]))!;
  }

  updateGroupInfo(
    conversationId: string,
    updates: { name?: string; description?: string; avatarId?: string | null },
  ) {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as
      | Record<string, unknown>
      | undefined;
    if (!row || row.type !== 'group') return null;

    this.db
      .prepare('UPDATE conversations SET name = ?, description = ?, avatar_id = ? WHERE id = ?')
      .run(
        updates.name ?? String(row.name),
        updates.description ?? String(row.description),
        updates.avatarId !== undefined ? updates.avatarId : (row.avatar_id as string | null),
        conversationId,
      );
    return true;
  }

  addGroupMember(conversationId: string, userId: string): boolean {
    const row = this.db.prepare('SELECT type FROM conversations WHERE id = ?').get(conversationId) as
      | { type: string }
      | undefined;
    if (!row || row.type !== 'group') return false;
    this.ensureMembership(conversationId, userId, 'member');
    return true;
  }

  removeGroupMember(conversationId: string, userId: string): boolean {
    const row = this.db.prepare('SELECT type FROM conversations WHERE id = ?').get(conversationId) as
      | { type: string }
      | undefined;
    if (!row || row.type !== 'group') return false;
    this.db
      .prepare('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
      .run(conversationId, userId);
    return true;
  }

  isConversationMember(conversationId: string, userId: string): boolean {
    if (conversationId === 'public') return true;
    const row = this.db
      .prepare(
        'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      )
      .get(conversationId, userId);
    return Boolean(row);
  }

  getMemberRole(conversationId: string, userId: string): 'admin' | 'member' | null {
    const row = this.db
      .prepare(
        'SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
      )
      .get(conversationId, userId) as { role: string } | undefined;
    if (!row) return null;
    return row.role === 'admin' ? 'admin' : 'member';
  }

  getConversationMemberIds(conversationId: string): string[] {
    const rows = this.db
      .prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?')
      .all(conversationId) as { user_id: string }[];
    return rows.map((r) => r.user_id);
  }

  getConversationsForUser(userId: string, onlineUserIds: Set<string>): ConversationSummary[] {
    const convRows = this.db
      .prepare(
        `SELECT c.* FROM conversations c
         INNER JOIN conversation_members cm ON c.id = cm.conversation_id
         WHERE cm.user_id = ?
         ORDER BY CASE WHEN c.id = 'public' THEN 0 ELSE 1 END, c.created_at DESC`,
      )
      .all(userId) as Record<string, unknown>[];

    return convRows
      .map((row) => this.buildConversationSummary(row, userId, onlineUserIds))
      .filter((c): c is ConversationSummary => c !== null);
  }

  getConversationSummary(
    conversationId: string,
    viewerId: string,
    onlineUserIds: Set<string>,
  ): ConversationSummary | null {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return this.buildConversationSummary(row, viewerId, onlineUserIds);
  }

  private buildConversationSummary(
    row: Record<string, unknown>,
    viewerId: string,
    onlineUserIds: Set<string>,
  ): ConversationSummary | null {
    const convId = String(row.id);
    const type = String(row.type) as 'public' | 'private' | 'group';

    const memberRows = this.db
      .prepare(
        `SELECT u.*, cm.role FROM conversation_members cm
         INNER JOIN users u ON u.id = cm.user_id
         WHERE cm.conversation_id = ?
         ORDER BY cm.role ASC, u.username ASC`,
      )
      .all(convId) as Record<string, unknown>[];

    const members: ConversationMember[] = memberRows.map((m) => ({
      userId: String(m.id),
      username: String(m.username),
      displayName: String(m.display_name),
      avatarUrl: m.avatar_id ? `/api/avatars/${String(m.avatar_id)}` : null,
      avatarColor: String(m.avatar_color),
      role: m.role === 'admin' ? 'admin' : 'member',
      isOnline: onlineUserIds.has(String(m.id)),
      presence: onlineUserIds.has(String(m.id))
        ? (String(m.presence) as UserPresence)
        : 'offline',
      lastActive: String(m.last_active),
    }));

    let displayName = String(row.name);
    let avatarUrl = row.avatar_id ? `/api/avatars/${String(row.avatar_id)}` : null;
    let peerUsername: string | undefined;
    let peerPresence: UserPresence | undefined;
    let peerIsOnline: boolean | undefined;
    let peerLastActive: string | undefined;

    if (type === 'private') {
      const peer = members.find((m) => m.userId !== viewerId) || members[0];
      if (peer) {
        displayName = peer.displayName || peer.username;
        avatarUrl = peer.avatarUrl;
        peerUsername = peer.username;
        peerPresence = peer.presence;
        peerIsOnline = peer.isOnline;
        peerLastActive = peer.lastActive;
      }
    }

    const lastMsg = this.db
      .prepare(
        `SELECT text, msg_type, sender_username, created_at, deleted
         FROM messages WHERE conversation_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(convId) as Record<string, unknown> | undefined;

    let lastMessageText: string | undefined;
    if (lastMsg) {
      if (Number(lastMsg.deleted) === 1) {
        lastMessageText = 'Message deleted';
      } else if (lastMsg.msg_type === 'media' && !String(lastMsg.text || '').trim()) {
        lastMessageText = 'Shared a media attachment';
      } else {
        lastMessageText = String(lastMsg.text);
      }
    }

    return {
      id: convId,
      type,
      name: displayName,
      description: String(row.description || ''),
      avatarUrl,
      peerUsername,
      peerPresence,
      peerIsOnline,
      peerLastActive,
      createdBy: row.created_by ? String(row.created_by) : undefined,
      members,
      lastMessageText,
      lastMessageSender: lastMsg ? String(lastMsg.sender_username) : undefined,
      lastMessageAt: lastMsg ? String(lastMsg.created_at) : undefined,
      unreadCount: 0,
    };
  }

  saveMediaFile(params: {
    id: string;
    storedFilename: string;
    originalFilename: string;
    mediaType: 'image' | 'video' | 'document' | 'audio' | 'avatar';
    mimeType: string;
    extension: string;
    sizeBytes: number;
    durationSec?: number | null;
    conversationId: string;
    uploaderId: string;
  }) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO media_files (id, stored_filename, original_filename, media_type, mime_type, extension, size_bytes, duration_sec, conversation_id, uploader_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.id,
        params.storedFilename,
        params.originalFilename,
        params.mediaType,
        params.mimeType,
        params.extension,
        params.sizeBytes,
        params.durationSec ?? null,
        params.conversationId,
        params.uploaderId,
        now,
      );
  }

  getMediaFileRecord(fileId: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT * FROM media_files WHERE id = ?').get(fileId) as
      | Record<string, unknown>
      | undefined;
    return row ?? null;
  }

  getMediaGalleryForConversation(conversationId: string): MediaAttachment[] {
    const rows = this.db
      .prepare(
        `SELECT mf.*, u.username AS uploader_username
         FROM media_files mf
         LEFT JOIN users u ON u.id = mf.uploader_id
         INNER JOIN messages m ON m.media_id = mf.id
         WHERE mf.conversation_id = ? AND m.deleted = 0
         ORDER BY mf.created_at DESC`,
      )
      .all(conversationId) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: String(r.id),
      originalFilename: String(r.original_filename),
      mediaType: String(r.media_type) as Exclude<MediaAttachment['mediaType'], never>,
      mimeType: String(r.mime_type),
      extension: String(r.extension),
      sizeBytes: Number(r.size_bytes),
      durationSec: r.duration_sec !== null ? Number(r.duration_sec) : null,
      url: `/api/media/${String(r.id)}`,
      downloadUrl: `/api/media/${String(r.id)}?download=1`,
      uploaderUsername: String(r.uploader_username || 'User'),
      createdAt: String(r.created_at),
    }));
  }

  createMessage(params: {
    conversationId: string;
    senderId: string;
    senderUsername: string;
    msgType: 'text' | 'media' | 'system';
    text: string;
    mediaId?: string | null;
    replyToId?: string | null;
    deliveryStatus?: 'sent' | 'delivered' | 'read';
  }): ChatMessage {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let replySender: string | null = null;
    let replyText: string | null = null;

    if (params.replyToId) {
      const target = this.db
        .prepare('SELECT sender_username, text, msg_type, deleted FROM messages WHERE id = ?')
        .get(params.replyToId) as Record<string, unknown> | undefined;
      if (target) {
        replySender = String(target.sender_username);
        replyText =
          Number(target.deleted) === 1
            ? 'Original message deleted'
            : target.msg_type === 'media' && !String(target.text || '').trim()
              ? 'Media attachment'
              : String(target.text).slice(0, 120);
      }
    }

    const readBy = [params.senderUsername];
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, sender_id, sender_username, msg_type, text, media_id, reply_to_id, reply_preview_sender, reply_preview_text, edited, deleted, delivery_status, read_by_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        params.conversationId,
        params.senderId,
        params.senderUsername,
        params.msgType,
        params.text,
        params.mediaId ?? null,
        params.replyToId ?? null,
        replySender,
        replyText,
        params.deliveryStatus ?? 'sent',
        JSON.stringify(readBy),
        now,
      );

    return this.getMessageById(id)!;
  }

  getMessageById(messageId: string): ChatMessage | null {
    const row = this.db
      .prepare(
        `SELECT m.*,
                u.display_name AS sender_display_name,
                u.avatar_id AS sender_avatar_id,
                u.avatar_color AS sender_avatar_color,
                mf.id AS mf_id,
                mf.original_filename AS mf_original_filename,
                mf.media_type AS mf_media_type,
                mf.mime_type AS mf_mime_type,
                mf.extension AS mf_extension,
                mf.size_bytes AS mf_size_bytes,
                mf.duration_sec AS mf_duration_sec,
                mf.created_at AS mf_created_at
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         LEFT JOIN media_files mf ON mf.id = m.media_id
         WHERE m.id = ?`,
      )
      .get(messageId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.mapMessageRow(row);
  }

  getConversationMessages(conversationId: string, limit = 150): ChatMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT m.*,
                  u.display_name AS sender_display_name,
                  u.avatar_id AS sender_avatar_id,
                  u.avatar_color AS sender_avatar_color,
                  mf.id AS mf_id,
                  mf.original_filename AS mf_original_filename,
                  mf.media_type AS mf_media_type,
                  mf.mime_type AS mf_mime_type,
                  mf.extension AS mf_extension,
                  mf.size_bytes AS mf_size_bytes,
                  mf.duration_sec AS mf_duration_sec,
                  mf.created_at AS mf_created_at
           FROM messages m
           LEFT JOIN users u ON u.id = m.sender_id
           LEFT JOIN media_files mf ON mf.id = m.media_id
           WHERE m.conversation_id = ?
           ORDER BY m.created_at DESC
           LIMIT ?
         ) sub ORDER BY created_at ASC`,
      )
      .all(conversationId, limit) as Record<string, unknown>[];

    return rows.map((row) => this.mapMessageRow(row));
  }

  editMessage(messageId: string, editorId: string, newText: string): ChatMessage | null {
    const existing = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return null;
    if (String(existing.sender_id) !== editorId) return null;
    if (Number(existing.deleted) === 1) return null;

    this.db
      .prepare('UPDATE messages SET text = ?, edited = 1, updated_at = ? WHERE id = ?')
      .run(newText, new Date().toISOString(), messageId);
    return this.getMessageById(messageId);
  }

  deleteMessage(messageId: string, requesterId: string): ChatMessage | null {
    const existing = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return null;

    const convId = String(existing.conversation_id);
    const isOwner = String(existing.sender_id) === requesterId;
    const isAdmin = this.getMemberRole(convId, requesterId) === 'admin';
    if (!isOwner && !isAdmin) return null;

    this.db
      .prepare(
        `UPDATE messages SET text = 'This message was deleted.', deleted = 1, media_id = NULL, updated_at = ? WHERE id = ?`,
      )
      .run(new Date().toISOString(), messageId);

    return this.getMessageById(messageId);
  }

  togglePinMessage(messageId: string, username: string): ChatMessage | null {
    const existing = this.db.prepare('SELECT id, pinned, deleted FROM messages WHERE id = ?').get(messageId) as
      | { id: string; pinned: number; deleted: number }
      | undefined;
    if (!existing || Number(existing.deleted) === 1) return null;

    const nextPinned = Number(existing.pinned) === 1 ? 0 : 1;
    const pinnedBy = nextPinned === 1 ? username : null;
    this.db
      .prepare('UPDATE messages SET pinned = ?, pinned_by = ? WHERE id = ?')
      .run(nextPinned, pinnedBy, messageId);
    return this.getMessageById(messageId);
  }

  toggleReaction(
    messageId: string,
    userId: string,
    username: string,
    emoji: string,
  ): ChatMessage | null {
    const exists = this.db
      .prepare(
        'SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      )
      .get(messageId, userId, emoji);

    if (exists) {
      this.db
        .prepare(
          'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
        )
        .run(messageId, userId, emoji);
    } else {
      this.db
        .prepare(
          'INSERT INTO message_reactions (message_id, user_id, username, emoji) VALUES (?, ?, ?, ?)',
        )
        .run(messageId, userId, username, emoji);
    }
    return this.getMessageById(messageId);
  }

  markConversationRead(conversationId: string, readerUsername: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT id, sender_username, read_by_json, delivery_status
         FROM messages
         WHERE conversation_id = ? AND msg_type != 'system' AND sender_username != ? AND delivery_status != 'read'`,
      )
      .all(conversationId, readerUsername) as Record<string, unknown>[];

    const updatedIds: string[] = [];
    for (const row of rows) {
      let readBy: string[] = [];
      try {
        readBy = JSON.parse(String(row.read_by_json || '[]'));
      } catch {
        readBy = [];
      }
      if (!readBy.includes(readerUsername)) {
        readBy.push(readerUsername);
      }
      this.db
        .prepare(`UPDATE messages SET delivery_status = 'read', read_by_json = ? WHERE id = ?`)
        .run(JSON.stringify(readBy), String(row.id));
      updatedIds.push(String(row.id));
    }
    return updatedIds;
  }

  searchMessages(conversationId: string, keyword: string): ChatMessage[] {
    const q = `%${keyword.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT m.*,
                u.display_name AS sender_display_name,
                u.avatar_id AS sender_avatar_id,
                u.avatar_color AS sender_avatar_color,
                mf.id AS mf_id,
                mf.original_filename AS mf_original_filename,
                mf.media_type AS mf_media_type,
                mf.mime_type AS mf_mime_type,
                mf.extension AS mf_extension,
                mf.size_bytes AS mf_size_bytes,
                mf.duration_sec AS mf_duration_sec,
                mf.created_at AS mf_created_at
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         LEFT JOIN media_files mf ON mf.id = m.media_id
         WHERE m.conversation_id = ? AND m.deleted = 0
           AND (m.text LIKE ? OR mf.original_filename LIKE ? OR m.sender_username LIKE ?)
         ORDER BY m.created_at DESC
         LIMIT 50`,
      )
      .all(conversationId, q, q, q) as Record<string, unknown>[];
    return rows.map((row) => this.mapMessageRow(row));
  }

  private mapUserRow(row: Record<string, unknown>, isOnline: boolean): UserProfile {
    return {
      id: String(row.id),
      username: String(row.username),
      displayName: String(row.display_name || row.username),
      bio: String(row.bio || ''),
      statusText: String(row.status_text || 'Available'),
      presence: isOnline ? (String(row.presence || 'online') as UserPresence) : 'offline',
      avatarUrl: row.avatar_id ? `/api/avatars/${String(row.avatar_id)}` : null,
      avatarColor: String(row.avatar_color || '#4F46E5'),
      isOnline,
      lastActive: String(row.last_active),
      joinedAt: formatClockTime(String(row.last_active)),
    };
  }

  private mapMessageRow(row: Record<string, unknown>): ChatMessage {
    const msgId = String(row.id);
    const reactionRows = this.db
      .prepare('SELECT emoji, username FROM message_reactions WHERE message_id = ?')
      .all(msgId) as { emoji: string; username: string }[];

    const grouped = new Map<string, string[]>();
    for (const r of reactionRows) {
      const list = grouped.get(r.emoji) || [];
      list.push(r.username);
      grouped.set(r.emoji, list);
    }
    const reactions: MessageReaction[] = Array.from(grouped.entries()).map(([emoji, users]) => ({
      emoji,
      users,
    }));

    let readBy: string[] = [];
    try {
      readBy = JSON.parse(String(row.read_by_json || '[]'));
    } catch {
      readBy = [];
    }

    const media: MediaAttachment | null =
      row.mf_id && Number(row.deleted) !== 1
        ? {
            id: String(row.mf_id),
            originalFilename: String(row.mf_original_filename),
            mediaType: String(row.mf_media_type) as Exclude<MediaAttachment['mediaType'], never>,
            mimeType: String(row.mf_mime_type),
            extension: String(row.mf_extension),
            sizeBytes: Number(row.mf_size_bytes),
            durationSec: row.mf_duration_sec !== null ? Number(row.mf_duration_sec) : null,
            url: `/api/media/${String(row.mf_id)}`,
            downloadUrl: `/api/media/${String(row.mf_id)}?download=1`,
            uploaderUsername: String(row.sender_username),
            createdAt: String(row.mf_created_at),
          }
        : null;

    const replyTo = row.reply_to_id
      ? {
          id: String(row.reply_to_id),
          sender: String(row.reply_preview_sender || 'User'),
          text: String(row.reply_preview_text || ''),
        }
      : null;

    return {
      id: msgId,
      conversationId: String(row.conversation_id),
      type: String(row.msg_type) as 'text' | 'media' | 'system',
      senderId: String(row.sender_id),
      sender: String(row.sender_username),
      senderDisplayName: String(row.sender_display_name || row.sender_username),
      senderAvatarUrl: row.sender_avatar_id ? `/api/avatars/${String(row.sender_avatar_id)}` : null,
      senderAvatarColor: String(row.sender_avatar_color || '#4F46E5'),
      text: String(row.text || ''),
      media,
      replyTo,
      reactions,
      edited: Number(row.edited) === 1,
      deleted: Number(row.deleted) === 1,
      pinned: Number(row.pinned || 0) === 1,
      pinnedBy: row.pinned_by ? String(row.pinned_by) : null,
      deliveryStatus: String(row.delivery_status || 'sent') as 'sent' | 'delivered' | 'read',
      readBy,
      timestamp: formatClockTime(String(row.created_at)),
      createdAt: String(row.created_at),
    };
  }
}
