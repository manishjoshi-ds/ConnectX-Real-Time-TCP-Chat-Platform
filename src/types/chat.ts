export type AppPage = 'landing' | 'login' | 'chat' | 'networks' | 'docs';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type UserPresence =
  | 'online'
  | 'available'
  | 'working'
  | 'busy'
  | 'gaming'
  | 'away'
  | 'offline';

export type ChatThemeId =
  | 'midnight-purple'
  | 'cyber-blue'
  | 'neon-green'
  | 'sunset-orange'
  | 'minimal-light';

export type MediaCategory = 'image' | 'video' | 'document' | 'audio' | 'avatar';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  statusText: string;
  presence: UserPresence;
  avatarUrl: string | null;
  avatarColor: string;
  isOnline: boolean;
  lastActive: string;
  joinedAt: string;
}

export interface ConversationMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string;
  role: 'admin' | 'member';
  isOnline: boolean;
  presence: UserPresence;
  lastActive: string;
}

export interface ConversationSummary {
  id: string;
  type: 'public' | 'private' | 'group';
  name: string;
  description: string;
  avatarUrl: string | null;
  peerUsername?: string;
  peerPresence?: UserPresence;
  peerIsOnline?: boolean;
  peerLastActive?: string;
  createdBy?: string;
  members: ConversationMember[];
  lastMessageText?: string;
  lastMessageSender?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface MediaAttachment {
  id: string;
  originalFilename: string;
  mediaType: Exclude<MediaCategory, 'avatar'>;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  durationSec?: number | null;
  url: string;
  downloadUrl: string;
  uploaderUsername: string;
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface ReplyReference {
  id: string;
  sender: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  type: 'text' | 'media' | 'system';
  senderId: string;
  sender: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  senderAvatarColor: string;
  text: string;
  media?: MediaAttachment | null;
  replyTo?: ReplyReference | null;
  reactions: MessageReaction[];
  edited: boolean;
  deleted: boolean;
  pinned?: boolean;
  pinnedBy?: string | null;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  readBy: string[];
  timestamp: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  conversationId: string;
  kind: 'message' | 'media' | 'group' | 'system' | 'error';
  createdAt: string;
}

export interface NetworkPacketEvent {
  id: string;
  eventType: 'join' | 'public_message' | 'private_message' | 'group_message' | 'typing' | 'ping' | 'leave';
  fromUsername: string;
  toUsernames: string[];
  conversationId: string;
  bytes: number;
  transport: string;
  timestamp: string;
}

export interface FlaskProjectFile {
  path: string;
  content: string;
}
