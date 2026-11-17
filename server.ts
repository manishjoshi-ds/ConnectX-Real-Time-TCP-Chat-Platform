import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { Server } from 'socket.io';
import { ChatDatabase } from './server/db.ts';
import {
  AVATARS_DIR,
  MAX_MEDIA_BYTES,
  MEDIA_DIR,
  detectAndValidateMedia,
  ensureUploadDirs,
  resolveSafeStoragePath,
  sanitizeOriginalFilename,
} from './server/media.ts';
import type { NetworkPacketEvent, UserPresence } from './src/types/chat.ts';

interface ActiveSession {
  sid: string;
  userId: string;
  username: string;
  normalized: string;
  authToken: string;
  joinedAt: string;
}

const PORT = Number(process.env.PORT) || 3000;
const USERNAME_REGEX = /^[A-Za-z0-9_ -]{2,24}$/;
const ALLOWED_MOODS: UserPresence[] = [
  'online',
  'available',
  'working',
  'busy',
  'gaming',
  'away',
];

const db = new ChatDatabase();
ensureUploadDirs();

const activeSessions = new Map<string, ActiveSession>(); // sid -> session
const tokenToSession = new Map<string, ActiveSession>(); // authToken -> session
const recentPackets: NetworkPacketEvent[] = [];

function validateUsername(raw: unknown): { valid: boolean; username: string; error: string } {
  if (typeof raw !== 'string') {
    return { valid: false, username: '', error: 'Username must be a text value.' };
  }
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return { valid: false, username: '', error: 'Please enter a username before joining.' };
  }
  if (cleaned.length < 2 || cleaned.length > 24) {
    return { valid: false, username: '', error: 'Username must be between 2 and 24 characters.' };
  }
  if (!USERNAME_REGEX.test(cleaned)) {
    return {
      valid: false,
      username: '',
      error: 'Username may only contain letters, numbers, spaces, hyphens, and underscores.',
    };
  }
  return { valid: true, username: cleaned, error: '' };
}

function validateMessage(raw: unknown, allowEmpty = false): { valid: boolean; text: string; error: string } {
  if (typeof raw !== 'string') {
    return allowEmpty
      ? { valid: true, text: '', error: '' }
      : { valid: false, text: '', error: 'Message must be a text value.' };
  }
  const cleaned = raw.trim();
  if (!cleaned && !allowEmpty) {
    return { valid: false, text: '', error: 'Cannot send an empty message.' };
  }
  if (cleaned.length > 2000) {
    return { valid: false, text: '', error: 'Message cannot exceed 2000 characters.' };
  }
  return { valid: true, text: cleaned, error: '' };
}

function getOnlineUserIds(): Set<string> {
  const ids = new Set<string>();
  for (const s of activeSessions.values()) {
    ids.add(s.userId);
  }
  return ids;
}

function getSessionsForUser(userId: string): ActiveSession[] {
  const list: ActiveSession[] = [];
  for (const s of activeSessions.values()) {
    if (s.userId === userId) list.push(s);
  }
  return list;
}

function getSessionFromRequest(req: express.Request): ActiveSession | null {
  const headerToken = req.header('x-auth-token') || '';
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const token = headerToken || bearer || queryToken;
  if (!token) return null;
  return tokenToSession.get(token) || null;
}

const uploadTempDir = path.resolve(process.cwd(), 'uploads', 'tmp');
fs.mkdirSync(uploadTempDir, { recursive: true });

const upload = multer({
  dest: uploadTempDir,
  limits: { fileSize: MAX_MEDIA_BYTES },
});

async function removeTempFile(filePath?: string) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['polling', 'websocket'],
    destroyUpgrade: false,
  });

  function broadcastDirectoryUpdate() {
    const onlineIds = getOnlineUserIds();
    const directory = db.getAllUsers(onlineIds);
    io.emit('users_update', {
      users: directory.filter((u) => u.isOnline),
      directory,
    });
  }

  function emitConversationMessagesToMembers(conversationId: string, eventName: string, payload: unknown) {
    if (conversationId === 'public') {
      io.emit(eventName, payload);
      return;
    }
    const memberIds = db.getConversationMemberIds(conversationId);
    for (const uid of memberIds) {
      for (const sess of getSessionsForUser(uid)) {
        io.to(sess.sid).emit(eventName, payload);
      }
    }
  }

  function syncConversationsForMembers(conversationId: string) {
    const onlineIds = getOnlineUserIds();
    const memberIds =
      conversationId === 'public'
        ? Array.from(onlineIds)
        : db.getConversationMemberIds(conversationId);

    for (const uid of memberIds) {
      const summary = db.getConversationSummary(conversationId, uid, onlineIds);
      if (!summary) continue;
      for (const sess of getSessionsForUser(uid)) {
        io.to(sess.sid).emit('conversation_updated', { conversation: summary });
      }
    }
  }

  function emitNetworkPacket(params: {
    eventType: NetworkPacketEvent['eventType'];
    fromUsername: string;
    toUsernames: string[];
    conversationId: string;
    bytes: number;
    transport?: string;
  }) {
    const packet: NetworkPacketEvent = {
      id: crypto.randomUUID(),
      eventType: params.eventType,
      fromUsername: params.fromUsername,
      toUsernames: params.toUsernames,
      conversationId: params.conversationId,
      bytes: Math.max(48, params.bytes),
      transport: params.transport || 'WebSocket/TCP',
      timestamp: new Date().toTimeString().slice(0, 8),
    };
    recentPackets.push(packet);
    if (recentPackets.length > 30) {
      recentPackets.shift();
    }
    io.emit('network_packet', packet);
  }

  // Health & status
  app.get('/api/health', (_req, res) => {
    const onlineIds = getOnlineUserIds();
    res.json({
      status: 'ok',
      transport: 'WebSocket over TCP (Socket.IO)',
      database: 'SQLite (WAL)',
      onlineUsers: onlineIds.size,
      users: db.getAllUsers(onlineIds).filter((u) => u.isOnline),
    });
  });

  // Flask project source files for Academic Docs explorer
  app.get('/api/flask-project', async (_req, res) => {
    const baseDir = path.resolve(process.cwd(), 'Multi_Client_Chat_Website');
    const relativePaths = [
      'app.py',
      'requirements.txt',
      'templates/index.html',
      'templates/chat.html',
      'static/style.css',
      'static/script.js',
      'README.md',
    ];
    try {
      const files = await Promise.all(
        relativePaths.map(async (rel) => {
          const fullPath = path.join(baseDir, rel);
          const content = await fsp.readFile(fullPath, 'utf-8');
          return { path: rel, content };
        }),
      );
      res.json({ files });
    } catch {
      res.status(500).json({ error: 'Unable to read Flask project source files.' });
    }
  });

  // HTTP Multipart Media Upload (Images, Videos, Documents, Audio)
  app.post('/api/upload', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized: please join the chat before uploading files.' });
      return;
    }

    upload.single('file')(req, res, async (err) => {
      if (err) {
        const msg =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'File exceeds maximum upload size of 50 MB.'
            : 'Upload failed during transfer.';
        res.status(400).json({ error: msg });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file attached to upload request.' });
        return;
      }

      const conversationId = String(req.body?.conversationId || 'public').trim();
      if (!db.isConversationMember(conversationId, session.userId)) {
        await removeTempFile(file.path);
        res.status(403).json({ error: 'You are not authorized to upload files to this conversation.' });
        return;
      }

      const requestedCategory =
        typeof req.body?.category === 'string' ? req.body.category : undefined;
      const check = detectAndValidateMedia(
        file.originalname,
        file.mimetype,
        file.size,
        requestedCategory,
      );

      if (!check.valid || !check.category || !check.ext || check.category === 'avatar') {
        await removeTempFile(file.path);
        res.status(400).json({ error: check.error || 'Invalid media file.' });
        return;
      }

      const fileId = crypto.randomUUID();
      const storedFilename = `${fileId}${check.ext}`;
      const finalPath = path.join(MEDIA_DIR, storedFilename);
      const safeOriginal = sanitizeOriginalFilename(file.originalname);

      const parsedDuration = Number(req.body?.durationSec);
      const durationSec =
        Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null;

      try {
        await fsp.rename(file.path, finalPath);
        db.saveMediaFile({
          id: fileId,
          storedFilename,
          originalFilename: safeOriginal,
          mediaType: check.category,
          mimeType: file.mimetype || 'application/octet-stream',
          extension: check.ext.replace('.', '').toUpperCase(),
          sizeBytes: file.size,
          durationSec,
          conversationId,
          uploaderId: session.userId,
        });

        res.status(201).json({
          media: {
            id: fileId,
            originalFilename: safeOriginal,
            mediaType: check.category,
            mimeType: file.mimetype || 'application/octet-stream',
            extension: check.ext.replace('.', '').toUpperCase(),
            sizeBytes: file.size,
            durationSec,
            url: `/api/media/${fileId}`,
            downloadUrl: `/api/media/${fileId}?download=1`,
            uploaderUsername: session.username,
            createdAt: new Date().toISOString(),
          },
        });
      } catch {
        await removeTempFile(file.path);
        res.status(500).json({ error: 'Server failed to store uploaded media safely.' });
      }
    });
  });

  // HTTP Multipart Avatar Upload (User Profile or Group Avatar)
  app.post('/api/upload-avatar', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized: active session required.' });
      return;
    }

    upload.single('file')(req, res, async (err) => {
      if (err) {
        res.status(400).json({ error: 'Avatar upload failed or exceeds size limit.' });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No image file provided.' });
        return;
      }

      const check = detectAndValidateMedia(file.originalname, file.mimetype, file.size, 'avatar');
      if (!check.valid || !check.ext) {
        await removeTempFile(file.path);
        res.status(400).json({ error: check.error || 'Invalid avatar image.' });
        return;
      }

      const targetType = String(req.body?.targetType || 'user');
      const targetId = String(req.body?.targetId || session.userId);

      if (targetType === 'group') {
        if (db.getMemberRole(targetId, session.userId) !== 'admin') {
          await removeTempFile(file.path);
          res.status(403).json({ error: 'Only group admins can update the group picture.' });
          return;
        }
      }

      const fileId = crypto.randomUUID();
      const storedFilename = `${fileId}${check.ext}`;
      const finalPath = path.join(AVATARS_DIR, storedFilename);
      const safeOriginal = sanitizeOriginalFilename(file.originalname);

      try {
        await fsp.rename(file.path, finalPath);
        db.saveMediaFile({
          id: fileId,
          storedFilename,
          originalFilename: safeOriginal,
          mediaType: 'avatar',
          mimeType: file.mimetype || 'image/png',
          extension: check.ext.replace('.', '').toUpperCase(),
          sizeBytes: file.size,
          durationSec: null,
          conversationId: targetType === 'group' ? targetId : 'public',
          uploaderId: session.userId,
        });

        if (targetType === 'group') {
          db.updateGroupInfo(targetId, { avatarId: fileId });
          syncConversationsForMembers(targetId);
        } else {
          db.updateUserProfile(session.userId, { avatarId: fileId });
          broadcastDirectoryUpdate();
          const updatedProfile = db.getUserById(session.userId, true);
          for (const s of getSessionsForUser(session.userId)) {
            io.to(s.sid).emit('profile_updated', { profile: updatedProfile });
          }
        }

        res.status(201).json({
          avatarId: fileId,
          avatarUrl: `/api/avatars/${fileId}`,
        });
      } catch {
        await removeTempFile(file.path);
        res.status(500).json({ error: 'Unable to store avatar image.' });
      }
    });
  });

  // Protected Media Streaming & Download Route (supports HTTP Range for video/audio)
  app.get('/api/media/:fileId', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Authentication required to access chat media.' });
      return;
    }

    const record = db.getMediaFileRecord(req.params.fileId);
    if (!record || record.media_type === 'avatar') {
      res.status(404).json({ error: 'Media file not found.' });
      return;
    }

    const conversationId = String(record.conversation_id);
    if (!db.isConversationMember(conversationId, session.userId)) {
      res.status(403).json({ error: 'Access denied for this conversation media.' });
      return;
    }

    const safePath = resolveSafeStoragePath(String(record.stored_filename), false);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'Media binary unavailable.' });
      return;
    }

    const stat = fs.statSync(safePath);
    const mimeType = String(record.mime_type || 'application/octet-stream');
    const originalName = sanitizeOriginalFilename(String(record.original_filename));
    const isDownload = req.query.download === '1';

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', mimeType);
    if (isDownload) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${originalName.replace(/"/g, '')}"`,
      );
    } else {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${originalName.replace(/"/g, '')}"`,
      );
    }

    const range = req.headers.range;
    if (range && !isDownload) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
        if (start < stat.size && start <= end) {
          res.status(206);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
          res.setHeader('Content-Length', String(end - start + 1));
          fs.createReadStream(safePath, { start, end }).pipe(res);
          return;
        }
      }
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(safePath).pipe(res);
  });

  // Avatar Serving Route
  app.get('/api/avatars/:fileId', (req, res) => {
    const record = db.getMediaFileRecord(req.params.fileId);
    if (!record || record.media_type !== 'avatar') {
      res.status(404).json({ error: 'Avatar not found.' });
      return;
    }
    const safePath = resolveSafeStoragePath(String(record.stored_filename), true);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'Avatar file missing.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', String(record.mime_type || 'image/png'));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(safePath).pipe(res);
  });

  // Conversation Messages, Search, and Media Gallery/File Manager APIs
  app.get('/api/conversations/:id/messages', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const convId = req.params.id;
    if (!db.isConversationMember(convId, session.userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const messages = db.getConversationMessages(convId);
    res.json({ messages });
  });

  app.get('/api/conversations/:id/media', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const convId = req.params.id;
    if (!db.isConversationMember(convId, session.userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const media = db.getMediaGalleryForConversation(convId);
    res.json({ media });
  });

  app.get('/api/conversations/:id/search', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const convId = req.params.id;
    if (!db.isConversationMember(convId, session.userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ results: [] });
      return;
    }
    const results = db.searchMessages(convId, q);
    res.json({ results });
  });

  // Socket.IO Real-Time Protocol
  io.on('connection', (socket) => {
    const initOnlineIds = getOnlineUserIds();
    const initDirectory = db.getAllUsers(initOnlineIds);
    socket.emit('server_info', {
      sid: socket.id,
      onlineCount: initOnlineIds.size,
      transport: socket.conn.transport.name,
      directory: initDirectory,
      recentPackets,
    });

    socket.on(
      'join_chat',
      (payload: { username?: unknown; mood?: unknown } | undefined) => {
        const { valid, username, error } = validateUsername(payload?.username);
        if (!valid) {
          socket.emit('join_error', { message: error });
          return;
        }

        const normalized = username.toLowerCase();

        // Clean up any previous session on this same socket
        const prior = activeSessions.get(socket.id);
        if (prior) {
          tokenToSession.delete(prior.authToken);
          activeSessions.delete(socket.id);
        }

        // Reject duplicate active username across other sockets
        for (const existing of activeSessions.values()) {
          if (existing.normalized === normalized) {
            socket.emit('join_error', {
              message: `Username "${username}" is already active in the room. Please choose another name.`,
            });
            return;
          }
        }

        const initialMood: UserPresence =
          typeof payload?.mood === 'string' && ALLOWED_MOODS.includes(payload.mood as UserPresence)
            ? (payload.mood as UserPresence)
            : 'available';

        const profile = db.upsertUserOnJoin(username, initialMood);
        const authToken = crypto.randomUUID();
        const session: ActiveSession = {
          sid: socket.id,
          userId: profile.id,
          username: profile.username,
          normalized,
          authToken,
          joinedAt: profile.joinedAt,
        };
        activeSessions.set(socket.id, session);
        tokenToSession.set(authToken, session);

        const joinNotification = db.createMessage({
          conversationId: 'public',
          senderId: 'system',
          senderUsername: 'Server',
          msgType: 'system',
          text: `${profile.username} joined the chat room.`,
          deliveryStatus: 'read',
        });

        const onlineIds = getOnlineUserIds();
        const directory = db.getAllUsers(onlineIds);
        const conversations = db.getConversationsForUser(profile.id, onlineIds);
        const publicMessages = db.getConversationMessages('public');

        socket.emit('join_success', {
          username: profile.username,
          userId: profile.id,
          sid: socket.id,
          authToken,
          profile,
          users: directory.filter((u) => u.isOnline),
          directory,
          conversations,
          activeConversationId: 'public',
          history: publicMessages,
          recentPackets,
        });

        socket.broadcast.emit('new_message', { message: joinNotification });
        broadcastDirectoryUpdate();
        emitNetworkPacket({
          eventType: 'join',
          fromUsername: profile.username,
          toUsernames: directory.filter((u) => u.isOnline && u.username !== profile.username).map((u) => u.username),
          conversationId: 'public',
          bytes: Buffer.byteLength(JSON.stringify(joinNotification)),
          transport: `${socket.conn.transport.name}/TCP`,
        });
      },
    );

    // Open or create a direct 1-to-1 conversation
    socket.on('open_dm', (payload: { targetUsername?: unknown } | undefined) => {
      const session = activeSessions.get(socket.id);
      if (!session) return;

      const targetName =
        typeof payload?.targetUsername === 'string' ? payload.targetUsername.trim() : '';
      if (!targetName) return;

      const me = db.getUserById(session.userId, true);
      const onlineIds = getOnlineUserIds();
      const target = db.getUserByUsername(targetName, false);
      if (!me || !target) {
        socket.emit('chat_error', { message: `User "${targetName}" was not found.` });
        return;
      }
      if (target.id === me.id) {
        socket.emit('chat_error', { message: 'Cannot open a private chat with yourself.' });
        return;
      }

      const convId = db.getOrCreateDmConversation(me, target);
      const myConv = db.getConversationSummary(convId, me.id, onlineIds);
      const targetConv = db.getConversationSummary(convId, target.id, onlineIds);
      const messages = db.getConversationMessages(convId);

      socket.emit('dm_opened', { conversation: myConv, messages });
      if (targetConv) {
        for (const s of getSessionsForUser(target.id)) {
          io.to(s.sid).emit('conversation_updated', { conversation: targetConv });
        }
      }
    });

    // Send text or media message to any authorized conversation (public, private, group)
    socket.on(
      'send_message',
      (
        payload:
          | {
              conversationId?: unknown;
              text?: unknown;
              mediaId?: unknown;
              replyToId?: unknown;
            }
          | undefined,
      ) => {
        const session = activeSessions.get(socket.id);
        if (!session) {
          socket.emit('chat_error', { message: 'Please join the chat before sending messages.' });
          return;
        }

        const conversationId =
          typeof payload?.conversationId === 'string' ? payload.conversationId.trim() : 'public';
        if (!db.isConversationMember(conversationId, session.userId)) {
          socket.emit('chat_error', {
            message: 'You are not a member of this conversation.',
          });
          return;
        }

        const mediaId = typeof payload?.mediaId === 'string' ? payload.mediaId.trim() : '';
        if (mediaId) {
          const mediaRec = db.getMediaFileRecord(mediaId);
          if (!mediaRec || String(mediaRec.conversation_id) !== conversationId) {
            socket.emit('chat_error', { message: 'Invalid or unauthorized media attachment.' });
            return;
          }
        }

        const { valid, text, error } = validateMessage(payload?.text ?? '', Boolean(mediaId));
        if (!valid) {
          socket.emit('chat_error', { message: error });
          return;
        }

        db.touchUserActivity(session.userId);
        const replyToId =
          typeof payload?.replyToId === 'string' && payload.replyToId.trim()
            ? payload.replyToId.trim()
            : null;

        // Determine initial delivery status: delivered if any other recipient is online
        const onlineIds = getOnlineUserIds();
        const otherRecipientsOnline =
          conversationId === 'public'
            ? onlineIds.size > 1
            : db
                .getConversationMemberIds(conversationId)
                .some((uid) => uid !== session.userId && onlineIds.has(uid));

        const message = db.createMessage({
          conversationId,
          senderId: session.userId,
          senderUsername: session.username,
          msgType: mediaId ? 'media' : 'text',
          text,
          mediaId: mediaId || null,
          replyToId,
          deliveryStatus: otherRecipientsOnline ? 'delivered' : 'sent',
        });

        emitConversationMessagesToMembers(conversationId, 'new_message', { message });
        syncConversationsForMembers(conversationId);

        const allOnline = db.getAllUsers(onlineIds).filter((u) => u.isOnline);
        const recipients =
          conversationId === 'public'
            ? allOnline.filter((u) => u.id !== session.userId).map((u) => u.username)
            : db
                .getConversationMemberIds(conversationId)
                .filter((uid) => uid !== session.userId)
                .map((uid) => db.getUserById(uid, onlineIds.has(uid))?.username)
                .filter((u): u is string => Boolean(u));

        const packetType: NetworkPacketEvent['eventType'] =
          conversationId === 'public'
            ? 'public_message'
            : conversationId.startsWith('dm:')
              ? 'private_message'
              : 'group_message';

        emitNetworkPacket({
          eventType: packetType,
          fromUsername: session.username,
          toUsernames: recipients,
          conversationId,
          bytes: Buffer.byteLength(JSON.stringify(message)),
          transport: `${socket.conn.transport.name}/TCP`,
        });
      },
    );

    // Backward-compatible public & private socket events
    socket.on('send_public_message', (payload: { text?: unknown } | undefined) => {
      const session = activeSessions.get(socket.id);
      if (!session) {
        socket.emit('chat_error', { message: 'Please join the chat before sending messages.' });
        return;
      }
      const { valid, text, error } = validateMessage(payload?.text);
      if (!valid) {
        socket.emit('chat_error', { message: error });
        return;
      }
      const onlineIds = getOnlineUserIds();
      const message = db.createMessage({
        conversationId: 'public',
        senderId: session.userId,
        senderUsername: session.username,
        msgType: 'text',
        text,
        deliveryStatus: onlineIds.size > 1 ? 'delivered' : 'sent',
      });
      io.emit('new_message', { message });
      io.emit('public_message', message);
      emitNetworkPacket({
        eventType: 'public_message',
        fromUsername: session.username,
        toUsernames: db
          .getAllUsers(onlineIds)
          .filter((u) => u.isOnline && u.id !== session.userId)
          .map((u) => u.username),
        conversationId: 'public',
        bytes: Buffer.byteLength(JSON.stringify(message)),
        transport: `${socket.conn.transport.name}/TCP`,
      });
    });

    socket.on(
      'send_private_message',
      (payload: { toUsername?: unknown; text?: unknown } | undefined) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;
        const targetRaw =
          typeof payload?.toUsername === 'string' ? payload.toUsername.trim() : '';
        const me = db.getUserById(session.userId, true);
        const target = db.getUserByUsername(targetRaw, false);
        if (!me || !target) {
          socket.emit('chat_error', { message: `User "${targetRaw}" not found.` });
          return;
        }
        const { valid, text, error } = validateMessage(payload?.text);
        if (!valid) {
          socket.emit('chat_error', { message: error });
          return;
        }
        const convId = db.getOrCreateDmConversation(me, target);
        const message = db.createMessage({
          conversationId: convId,
          senderId: session.userId,
          senderUsername: session.username,
          msgType: 'text',
          text,
          deliveryStatus: getSessionsForUser(target.id).length > 0 ? 'delivered' : 'sent',
        });
        emitConversationMessagesToMembers(convId, 'new_message', { message });
        syncConversationsForMembers(convId);
        emitNetworkPacket({
          eventType: 'private_message',
          fromUsername: session.username,
          toUsernames: [target.username],
          conversationId: convId,
          bytes: Buffer.byteLength(JSON.stringify(message)),
          transport: `${socket.conn.transport.name}/TCP`,
        });
      },
    );

    // Typing indicators
    socket.on(
      'typing_state',
      (payload: { conversationId?: unknown; isTyping?: unknown } | undefined) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;
        const conversationId =
          typeof payload?.conversationId === 'string' ? payload.conversationId : 'public';
        if (!db.isConversationMember(conversationId, session.userId)) return;

        const isTyping = Boolean(payload?.isTyping);
        const out = {
          conversationId,
          username: session.username,
          isTyping,
        };
        if (conversationId === 'public') {
          socket.broadcast.emit('typing_update', out);
        } else {
          const memberIds = db.getConversationMemberIds(conversationId);
          for (const uid of memberIds) {
            if (uid === session.userId) continue;
            for (const s of getSessionsForUser(uid)) {
              io.to(s.sid).emit('typing_update', out);
            }
          }
        }
        if (isTyping) {
          emitNetworkPacket({
            eventType: 'typing',
            fromUsername: session.username,
            toUsernames: [],
            conversationId,
            bytes: Buffer.byteLength(JSON.stringify(out)),
            transport: `${socket.conn.transport.name}/TCP`,
          });
        }
      },
    );

    // Real Socket.IO Network Round-Trip Ping for Network Visualizer
    socket.on('ping_network', () => {
      const session = activeSessions.get(socket.id);
      const fromName = session?.username || `Guest-${socket.id.slice(0, 4)}`;
      emitNetworkPacket({
        eventType: 'ping',
        fromUsername: fromName,
        toUsernames: [fromName],
        conversationId: 'public',
        bytes: 64,
        transport: `${socket.conn.transport.name}/TCP`,
      });
    });

    // Read Receipts
    socket.on('mark_read', (payload: { conversationId?: unknown } | undefined) => {
      const session = activeSessions.get(socket.id);
      if (!session) return;
      const conversationId =
        typeof payload?.conversationId === 'string' ? payload.conversationId : '';
      if (!conversationId || !db.isConversationMember(conversationId, session.userId)) return;

      const updatedIds = db.markConversationRead(conversationId, session.username);
      if (updatedIds.length > 0) {
        emitConversationMessagesToMembers(conversationId, 'messages_read', {
          conversationId,
          messageIds: updatedIds,
          reader: session.username,
        });
      }
    });

    // Edit Message
    socket.on(
      'edit_message',
      (payload: { messageId?: unknown; text?: unknown } | undefined) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;
        const messageId = typeof payload?.messageId === 'string' ? payload.messageId : '';
        const { valid, text, error } = validateMessage(payload?.text);
        if (!valid) {
          socket.emit('chat_error', { message: error });
          return;
        }
        const updated = db.editMessage(messageId, session.userId, text);
        if (!updated) {
          socket.emit('chat_error', { message: 'Unable to edit that message.' });
          return;
        }
        emitConversationMessagesToMembers(updated.conversationId, 'message_updated', {
          message: updated,
        });
        syncConversationsForMembers(updated.conversationId);
      },
    );

    // Delete Message
    socket.on('delete_message', (payload: { messageId?: unknown } | undefined) => {
      const session = activeSessions.get(socket.id);
      if (!session) return;
      const messageId = typeof payload?.messageId === 'string' ? payload.messageId : '';
      const updated = db.deleteMessage(messageId, session.userId);
      if (!updated) {
        socket.emit('chat_error', { message: 'Unable to delete that message.' });
        return;
      }
      emitConversationMessagesToMembers(updated.conversationId, 'message_updated', {
        message: updated,
      });
      syncConversationsForMembers(updated.conversationId);
    });

    // Toggle Emoji Reaction
    socket.on(
      'toggle_reaction',
      (payload: { messageId?: unknown; emoji?: unknown } | undefined) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;
        const messageId = typeof payload?.messageId === 'string' ? payload.messageId : '';
        const emoji = typeof payload?.emoji === 'string' ? payload.emoji.trim().slice(0, 8) : '';
        if (!messageId || !emoji) return;

        const targetMsg = db.getMessageById(messageId);
        if (!targetMsg || !db.isConversationMember(targetMsg.conversationId, session.userId)) {
          return;
        }
        const updated = db.toggleReaction(messageId, session.userId, session.username, emoji);
        if (updated) {
          emitConversationMessagesToMembers(updated.conversationId, 'message_updated', {
            message: updated,
          });
        }
      },
    );

    // Toggle Pin / Spotlight Message
    socket.on('toggle_pin', (payload: { messageId?: unknown } | undefined) => {
      const session = activeSessions.get(socket.id);
      if (!session) return;
      const messageId = typeof payload?.messageId === 'string' ? payload.messageId : '';
      if (!messageId) return;

      const targetMsg = db.getMessageById(messageId);
      if (!targetMsg || !db.isConversationMember(targetMsg.conversationId, session.userId)) {
        return;
      }
      const updated = db.togglePinMessage(messageId, session.username);
      if (updated) {
        emitConversationMessagesToMembers(updated.conversationId, 'message_updated', {
          message: updated,
        });
      }
    });

    // Update User Profile
    socket.on(
      'update_profile',
      (
        payload:
          | {
              displayName?: unknown;
              bio?: unknown;
              statusText?: unknown;
              presence?: unknown;
              avatarColor?: unknown;
            }
          | undefined,
      ) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;

        const displayNameRaw =
          typeof payload?.displayName === 'string' ? payload.displayName.trim() : session.username;
        if (!displayNameRaw || displayNameRaw.length > 32) {
          socket.emit('chat_error', {
            message: 'Display name must be between 1 and 32 characters.',
          });
          return;
        }
        const bio = typeof payload?.bio === 'string' ? payload.bio.trim().slice(0, 160) : '';
        const statusText =
          typeof payload?.statusText === 'string'
            ? payload.statusText.trim().slice(0, 48)
            : 'Available';
        const presence: UserPresence =
          typeof payload?.presence === 'string' &&
          ALLOWED_MOODS.includes(payload.presence as UserPresence)
            ? (payload.presence as UserPresence)
            : 'available';
        const avatarColor =
          typeof payload?.avatarColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(payload.avatarColor)
            ? payload.avatarColor
            : undefined;

        const updated = db.updateUserProfile(session.userId, {
          displayName: displayNameRaw,
          bio,
          statusText,
          presence,
          avatarColor,
        });
        if (updated) {
          socket.emit('profile_updated', { profile: updated });
          broadcastDirectoryUpdate();
        }
      },
    );

    // Group Chat Creation & Management
    socket.on(
      'create_group',
      (payload: { name?: unknown; description?: unknown; memberUsernames?: unknown } | undefined) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;

        const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
        if (name.length < 2 || name.length > 40) {
          socket.emit('chat_error', {
            message: 'Group name must be between 2 and 40 characters.',
          });
          return;
        }
        const description =
          typeof payload?.description === 'string' ? payload.description.trim().slice(0, 120) : '';
        const rawUsernames = Array.isArray(payload?.memberUsernames)
          ? payload.memberUsernames
          : [];

        const memberIds: string[] = [];
        for (const uname of rawUsernames) {
          if (typeof uname !== 'string') continue;
          const user = db.getUserByUsername(uname, false);
          if (user && !memberIds.includes(user.id)) {
            memberIds.push(user.id);
          }
        }

        const group = db.createGroupConversation({
          name,
          description,
          creatorId: session.userId,
          memberIds,
        });

        const sysMsg = db.createMessage({
          conversationId: group.id,
          senderId: 'system',
          senderUsername: 'Server',
          msgType: 'system',
          text: `${session.username} created the group "${group.name}".`,
          deliveryStatus: 'read',
        });

        syncConversationsForMembers(group.id);
        emitConversationMessagesToMembers(group.id, 'new_message', { message: sysMsg });
        socket.emit('group_created', { conversation: group });
      },
    );

    socket.on(
      'add_group_member',
      (payload: { conversationId?: unknown; username?: unknown } | undefined) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;
        const convId =
          typeof payload?.conversationId === 'string' ? payload.conversationId : '';
        const targetUsername =
          typeof payload?.username === 'string' ? payload.username.trim() : '';

        if (db.getMemberRole(convId, session.userId) !== 'admin') {
          socket.emit('chat_error', { message: 'Only group admins can add participants.' });
          return;
        }

        const targetUser = db.getUserByUsername(targetUsername, false);
        if (!targetUser) {
          socket.emit('chat_error', { message: `User "${targetUsername}" not found.` });
          return;
        }

        db.addGroupMember(convId, targetUser.id);
        const sysMsg = db.createMessage({
          conversationId: convId,
          senderId: 'system',
          senderUsername: 'Server',
          msgType: 'system',
          text: `${session.username} added ${targetUser.username} to the group.`,
          deliveryStatus: 'read',
        });

        syncConversationsForMembers(convId);
        emitConversationMessagesToMembers(convId, 'new_message', { message: sysMsg });
      },
    );

    socket.on(
      'remove_group_member',
      (payload: { conversationId?: unknown; userId?: unknown } | undefined) => {
        const session = activeSessions.get(socket.id);
        if (!session) return;
        const convId =
          typeof payload?.conversationId === 'string' ? payload.conversationId : '';
        const targetUserId = typeof payload?.userId === 'string' ? payload.userId : '';

        const isAdmin = db.getMemberRole(convId, session.userId) === 'admin';
        const isSelfLeave = targetUserId === session.userId;
        if (!isAdmin && !isSelfLeave) {
          socket.emit('chat_error', {
            message: 'Only group admins can remove other participants.',
          });
          return;
        }

        const targetUser = db.getUserById(targetUserId, false);
        if (!targetUser) return;

        db.removeGroupMember(convId, targetUserId);
        const sysMsg = db.createMessage({
          conversationId: convId,
          senderId: 'system',
          senderUsername: 'Server',
          msgType: 'system',
          text: isSelfLeave
            ? `${targetUser.username} left the group.`
            : `${session.username} removed ${targetUser.username} from the group.`,
          deliveryStatus: 'read',
        });

        for (const s of getSessionsForUser(targetUserId)) {
          io.to(s.sid).emit('removed_from_group', { conversationId: convId });
        }
        syncConversationsForMembers(convId);
        emitConversationMessagesToMembers(convId, 'new_message', { message: sysMsg });
      },
    );

    const handleLeave = () => {
      const removed = activeSessions.get(socket.id);
      if (!removed) return false;

      activeSessions.delete(socket.id);
      tokenToSession.delete(removed.authToken);

      if (getSessionsForUser(removed.userId).length === 0) {
        db.markUserOffline(removed.userId);
        const leaveMsg = db.createMessage({
          conversationId: 'public',
          senderId: 'system',
          senderUsername: 'Server',
          msgType: 'system',
          text: `${removed.username} left the chat room.`,
          deliveryStatus: 'read',
        });
        socket.broadcast.emit('new_message', { message: leaveMsg });
        emitNetworkPacket({
          eventType: 'leave',
          fromUsername: removed.username,
          toUsernames: [],
          conversationId: 'public',
          bytes: Buffer.byteLength(JSON.stringify(leaveMsg)),
          transport: 'TCP FIN / Socket.IO',
        });
      }
      broadcastDirectoryUpdate();
      return true;
    };

    socket.on('logout', () => {
      handleLeave();
      socket.emit('logged_out', { success: true });
    });

    socket.on('disconnect', () => {
      handleLeave();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: {
          server,
          path: '/vite-hmr',
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TCPChat server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
