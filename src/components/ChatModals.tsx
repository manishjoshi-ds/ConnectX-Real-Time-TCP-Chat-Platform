import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Camera,
  Check,
  Download,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  Music,
  Palette,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import type {
  ChatThemeId,
  ConversationSummary,
  MediaAttachment,
  UserPresence,
  UserProfile,
} from '../types/chat';
import {
  CHAT_THEMES,
  MOOD_CONFIGS,
  PROFILE_COLORS,
  formatBytes,
  formatDuration,
  formatLastActive,
  withAuthToken,
} from '../utils/format';
import { Avatar } from './Avatar';

/* -------------------------------------------------------------------------- */
/* 1. Full-Screen Image Lightbox                                              */
/* -------------------------------------------------------------------------- */
export function ImageLightboxModal({
  media,
  authToken,
  onClose,
}: {
  media: MediaAttachment | null;
  authToken: string;
  onClose: () => void;
}) {
  if (!media) return null;
  const srcUrl = withAuthToken(media.url, authToken);
  const downloadUrl = withAuthToken(media.downloadUrl, authToken);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image full-screen preview"
      className="fixed inset-0 z-50 flex flex-col bg-[#050612]/92 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{media.originalFilename}</p>
          <p className="font-mono text-xs text-slate-400">
            Shared by {media.uploaderUsername} · {formatBytes(media.sizeBytes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={downloadUrl}
            download={media.originalFilename}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <img
          src={srcUrl}
          alt={media.originalFilename}
          referrerPolicy="no-referrer"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[84vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/15"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Interactive User Profile Card Modal                                     */
/* -------------------------------------------------------------------------- */
export function UserCardModal({
  user,
  currentUser,
  onClose,
  onStartPrivateChat,
}: {
  user: UserProfile | null;
  currentUser: string;
  onClose: () => void;
  onStartPrivateChat: (username: string) => void;
}) {
  if (!user) return null;
  const mood = MOOD_CONFIGS[user.presence] || MOOD_CONFIGS.offline;
  const isSelf = user.username === currentUser;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${user.displayName} profile card`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-violet-500/25 dark:bg-[#0d1026]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${user.avatarColor || '#7C3AED'}, #2563EB)`,
          }}
          className="relative h-24 px-5 pt-4"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close user card"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-white hover:bg-black/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-8 flex items-end justify-between gap-3">
            <div className="rounded-2xl bg-white p-1 shadow-md dark:bg-[#0d1026]">
              <Avatar
                name={user.displayName || user.username}
                avatarUrl={user.avatarUrl}
                color={user.avatarColor}
                size="lg"
                presence={user.presence}
                showPresence
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${mood.dotClass}`} />
              <span className={mood.textClass}>{mood.label}</span>
            </div>
          </div>

          <div className="mt-3">
            <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">
              {user.displayName || user.username}
            </h3>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              @{user.username} ·{' '}
              {user.isOnline ? 'Connected over TCP' : `Last active ${formatLastActive(user.lastActive)}`}
            </p>
          </div>

          {user.statusText && (
            <p className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
              {user.statusText}
            </p>
          )}

          {user.bio && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {user.bio}
            </p>
          )}

          <div className="mt-5 flex gap-2.5">
            {!isSelf && (
              <button
                type="button"
                onClick={() => {
                  onStartPrivateChat(user.username);
                  onClose();
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-violet-600/20 hover:brightness-110"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Start Private Chat</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. User Profile, Mood, Color & Preferences Modal                           */
/* -------------------------------------------------------------------------- */
const MOOD_OPTIONS: { value: UserPresence; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'working', label: 'Working' },
  { value: 'busy', label: 'Busy' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'away', label: 'Away' },
];

export function ProfileSettingsModal({
  open,
  profile,
  socketId,
  authToken,
  soundEnabled,
  effectsEnabled,
  onToggleSound,
  onToggleEffects,
  onClose,
  onSaveProfile,
  onAvatarUpdated,
  onNotifyError,
}: {
  open: boolean;
  profile: UserProfile | null;
  socketId: string;
  authToken: string;
  soundEnabled: boolean;
  effectsEnabled: boolean;
  onToggleSound: () => void;
  onToggleEffects: () => void;
  onClose: () => void;
  onSaveProfile: (data: {
    displayName: string;
    bio: string;
    statusText: string;
    presence: UserPresence;
    avatarColor: string;
  }) => void;
  onAvatarUpdated: () => void;
  onNotifyError: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [statusText, setStatusText] = useState('Available');
  const [presence, setPresence] = useState<UserPresence>('available');
  const [avatarColor, setAvatarColor] = useState('#7C3AED');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile && open) {
      setDisplayName(profile.displayName || profile.username);
      setBio(profile.bio || '');
      setStatusText(profile.statusText || 'Available');
      setPresence(profile.presence === 'offline' || profile.presence === 'online' ? 'available' : profile.presence);
      setAvatarColor(profile.avatarColor || '#7C3AED');
    }
  }, [profile, open]);

  if (!open || !profile) return null;

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetType', 'user');
      formData.append('targetId', profile.id);

      const res = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: { 'x-auth-token': authToken },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        onNotifyError(json.error || 'Failed to upload profile photo.');
      } else {
        onAvatarUpdated();
      }
    } catch {
      onNotifyError('Network error while uploading profile photo.');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      onNotifyError('Display name cannot be empty.');
      return;
    }
    onSaveProfile({
      displayName: displayName.trim(),
      bio: bio.trim(),
      statusText: statusText.trim() || 'Available',
      presence,
      avatarColor,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile and Preferences"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-violet-500/25 dark:bg-[#0d1026]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Profile, Mood & Preferences
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[82vh] space-y-5 overflow-y-auto p-6">
          {/* Avatar Upload Row */}
          <div className="flex items-center gap-4">
            <Avatar
              name={displayName || profile.username}
              avatarUrl={profile.avatarUrl}
              color={avatarColor}
              size="lg"
              presence={presence}
              showPresence
              animatedRing
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                @{profile.username}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                JPG, PNG, or WEBP up to 5 MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => fileRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{uploadingAvatar ? 'Uploading...' : 'Upload Profile Photo'}</span>
              </button>
            </div>
          </div>

          {/* Profile Accent Color Swatches */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Profile Color
            </label>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {PROFILE_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setAvatarColor(hex)}
                  style={{ backgroundColor: hex }}
                  aria-label={`Select color ${hex}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform hover:scale-110 ${
                    avatarColor === hex ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-[#0d1026]' : ''
                  }`}
                >
                  {avatarColor === hex && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-600 focus:outline-none dark:border-white/15 dark:bg-[#060714] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chat Mood Indicator
              </label>
              <select
                value={presence}
                onChange={(e) => setPresence(e.target.value as UserPresence)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-600 focus:outline-none dark:border-white/15 dark:bg-[#060714] dark:text-white"
              >
                {MOOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Custom Status Note
            </label>
            <input
              type="text"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              maxLength={48}
              placeholder="e.g., Building TCP Visualizer"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-600 focus:outline-none dark:border-white/15 dark:bg-[#060714] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Short Bio
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder="Tell others about yourself..."
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-600 focus:outline-none dark:border-white/15 dark:bg-[#060714] dark:text-white"
            />
          </div>

          {/* Interactive Effects & Sound Controls */}
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-white/10 dark:bg-[#060714]/70">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Interactive Audio & Celebration Controls
            </p>
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Volume2 className="h-3.5 w-3.5 text-violet-500" />
                <span>Subtle Message Sound Effects</span>
              </span>
              <button
                type="button"
                onClick={onToggleSound}
                className={`rounded-lg px-3 py-1 font-semibold transition-colors ${
                  soundEnabled
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {soundEnabled ? 'On' : 'Off'}
              </button>
            </div>
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                <span>Confetti & Particle Animations</span>
              </span>
              <button
                type="button"
                onClick={onToggleEffects}
                className={`rounded-lg px-3 py-1 font-semibold transition-colors ${
                  effectsEnabled
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {effectsEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Socket Session Info */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-white/10 dark:bg-[#060714]/70">
            <dl className="grid grid-cols-1 gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex justify-between gap-2">
                <dt>Socket SID</dt>
                <dd className="truncate">{socketId || 'Active'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Transport</dt>
                <dd>WebSocket over TCP (Socket.IO)</dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Custom & Per-Conversation Chat Themes Modal                             */
/* -------------------------------------------------------------------------- */
export function ThemeCustomizerModal({
  open,
  globalTheme,
  conversationTheme,
  conversationName,
  onSelectGlobalTheme,
  onSelectConversationTheme,
  onResetConversationTheme,
  onClose,
}: {
  open: boolean;
  globalTheme: ChatThemeId;
  conversationTheme?: ChatThemeId | null;
  conversationName: string;
  onSelectGlobalTheme: (theme: ChatThemeId) => void;
  onSelectConversationTheme: (theme: ChatThemeId) => void;
  onResetConversationTheme: () => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<'conversation' | 'global'>(
    conversationTheme ? 'conversation' : 'global',
  );

  if (!open) return null;

  const activeThemeId = scope === 'conversation' ? conversationTheme || globalTheme : globalTheme;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customize Chat Appearance"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-violet-500/25 dark:bg-[#0d1026]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-violet-600 dark:text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Chat Themes
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close theme customizer"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scope Selector: Global vs This Conversation */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#060714]">
          <button
            type="button"
            onClick={() => setScope('global')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              scope === 'global'
                ? 'bg-white text-slate-950 shadow-xs dark:bg-violet-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            All Chats (Default)
          </button>
          <button
            type="button"
            onClick={() => setScope('conversation')}
            className={`truncate rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
              scope === 'conversation'
                ? 'bg-white text-slate-950 shadow-xs dark:bg-violet-600 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Only: {conversationName}
          </button>
        </div>

        <div className="space-y-2.5">
          {Object.values(CHAT_THEMES).map((theme) => {
            const active = activeThemeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() =>
                  scope === 'conversation'
                    ? onSelectConversationTheme(theme.id)
                    : onSelectGlobalTheme(theme.id)
                }
                className={`flex w-full items-center gap-3.5 rounded-xl border p-3 text-left transition-all ${
                  active
                    ? 'border-violet-600 bg-violet-50/70 dark:border-cyan-400 dark:bg-violet-950/50'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-slate-900/70'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${theme.swatchClass} shadow-sm`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">
                    {theme.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {theme.description}
                  </p>
                </div>
                {active && <Check className="h-4 w-4 shrink-0 text-violet-600 dark:text-cyan-400" />}
              </button>
            );
          })}
        </div>

        {scope === 'conversation' && conversationTheme && (
          <button
            type="button"
            onClick={onResetConversationTheme}
            className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Reset {conversationName} to Default Theme
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Create Group Modal                                                      */
/* -------------------------------------------------------------------------- */
export function CreateGroupModal({
  open,
  directory,
  currentUser,
  onClose,
  onCreateGroup,
}: {
  open: boolean;
  directory: UserProfile[];
  currentUser: string;
  onClose: () => void;
  onCreateGroup: (name: string, description: string, memberUsernames: string[]) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');

  if (!open) return null;

  const candidates = directory.filter((u) => u.username !== currentUser);

  const toggleUser = (username: string) => {
    setSelected((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username],
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Group name must be at least 2 characters.');
      return;
    }
    onCreateGroup(name.trim(), description.trim(), selected);
    setName('');
    setDescription('');
    setSelected([]);
    setError('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create New Group Chat"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-violet-500/25 dark:bg-[#0d1026]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600 dark:text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Create Group Chat
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Group Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g., CN Project Team"
              maxLength={40}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-600 focus:outline-none dark:border-white/15 dark:bg-[#060714] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              maxLength={120}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-violet-600 focus:outline-none dark:border-white/15 dark:bg-[#060714] dark:text-white"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Add Participants ({selected.length} selected)
            </p>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-white/10">
              {candidates.length === 0 ? (
                <p className="p-2 text-xs text-slate-500 dark:text-slate-400">
                  No other users available yet. You can add members after they join.
                </p>
              ) : (
                candidates.map((u) => {
                  const checked = selected.includes(u.username);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.username)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        checked
                          ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-cyan-200'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Avatar
                          name={u.displayName}
                          avatarUrl={u.avatarUrl}
                          color={u.avatarColor}
                          size="xs"
                          presence={u.presence}
                          showPresence
                        />
                        <span className="font-medium">{u.displayName}</span>
                        <span className="text-xs text-slate-500">@{u.username}</span>
                      </span>
                      {checked && <Check className="h-4 w-4 text-violet-600 dark:text-cyan-400" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Group Info & Members Modal                                              */
/* -------------------------------------------------------------------------- */
export function GroupInfoModal({
  open,
  group,
  currentUserId,
  directory,
  authToken,
  onClose,
  onAddMember,
  onRemoveMember,
  onAvatarUpdated,
  onNotifyError,
}: {
  open: boolean;
  group: ConversationSummary | null;
  currentUserId: string;
  directory: UserProfile[];
  authToken: string;
  onClose: () => void;
  onAddMember: (conversationId: string, username: string) => void;
  onRemoveMember: (conversationId: string, userId: string) => void;
  onAvatarUpdated: () => void;
  onNotifyError: (msg: string) => void;
}) {
  const [selectedToAdd, setSelectedToAdd] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  if (!open || !group || group.type !== 'group') return null;

  const me = group.members.find((m) => m.userId === currentUserId);
  const isAdmin = me?.role === 'admin';
  const memberIds = new Set(group.members.map((m) => m.userId));
  const addableUsers = directory.filter((u) => !memberIds.has(u.id));

  const handleGroupAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('targetType', 'group');
      form.append('targetId', group.id);
      const res = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: { 'x-auth-token': authToken },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        onNotifyError(json.error || 'Failed to upload group photo.');
      } else {
        onAvatarUpdated();
      }
    } catch {
      onNotifyError('Network error while uploading group photo.');
    } finally {
      setUploadingPhoto(false);
      if (photoRef.current) photoRef.current.value = '';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Group Information and Members"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-violet-500/25 dark:bg-[#0d1026]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Group Details & Members
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close group modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
          <div className="flex items-center gap-4">
            <Avatar name={group.name} avatarUrl={group.avatarUrl} color="#06B6D4" size="lg" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-lg font-bold text-slate-950 dark:text-white">
                {group.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {group.description || 'Multi-client TCP group conversation'} · {group.members.length}{' '}
                {group.members.length === 1 ? 'member' : 'members'}
              </p>
              {isAdmin && (
                <>
                  <input
                    ref={photoRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleGroupAvatarUpload}
                  />
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => photoRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>{uploadingPhoto ? 'Uploading...' : 'Change Group Photo'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {isAdmin && addableUsers.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-[#060714]">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Add Participant (Admin)
              </p>
              <div className="mt-2 flex gap-2">
                <select
                  value={selectedToAdd}
                  onChange={(e) => setSelectedToAdd(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Select a user...</option>
                  {addableUsers.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.displayName} (@{u.username})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedToAdd}
                  onClick={() => {
                    if (!selectedToAdd) return;
                    onAddMember(group.id, selectedToAdd);
                    setSelectedToAdd('');
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Participants
            </p>
            <ul className="mt-2 space-y-2">
              {group.members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5 dark:border-white/10"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={m.displayName}
                      avatarUrl={m.avatarUrl}
                      color={m.avatarColor}
                      size="sm"
                      presence={m.presence}
                      showPresence
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {m.displayName} {m.role === 'admin' ? '· Admin' : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        @{m.username} ·{' '}
                        {m.isOnline ? 'Online' : `Last seen ${formatLastActive(m.lastActive)}`}
                      </p>
                    </div>
                  </div>

                  {isAdmin && m.userId !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(group.id, m.userId)}
                      title="Remove member"
                      aria-label={`Remove ${m.username}`}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-between border-t border-slate-200/80 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                onRemoveMember(group.id, currentUserId);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Leave Group</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Media Gallery & File Manager Modal                                      */
/* -------------------------------------------------------------------------- */
export function MediaAndFilesModal({
  open,
  initialTab,
  conversationId,
  conversationName,
  authToken,
  onClose,
  onOpenLightbox,
}: {
  open: boolean;
  initialTab: 'gallery' | 'files';
  conversationId: string;
  conversationName: string;
  authToken: string;
  onClose: () => void;
  onOpenLightbox: (media: MediaAttachment) => void;
}) {
  const [tab, setTab] = useState<'gallery' | 'files'>(initialTab);
  const [items, setItems] = useState<MediaAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!open || !conversationId || !authToken) return;
    let active = true;
    setLoading(true);
    fetch(`/api/conversations/${encodeURIComponent(conversationId)}/media`, {
      headers: { 'x-auth-token': authToken },
    })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (Array.isArray(json.media)) setItems(json.media);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, conversationId, authToken]);

  if (!open) return null;

  const galleryItems = items.filter((m) => m.mediaType === 'image' || m.mediaType === 'video');
  const fileItems = items.filter(
    (m) =>
      (m.mediaType === 'document' || m.mediaType === 'audio') &&
      m.originalFilename.toLowerCase().includes(filterText.trim().toLowerCase()),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media Gallery and File Manager"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-violet-500/25 dark:bg-[#0d1026]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              {tab === 'gallery' ? 'Media Gallery' : 'File Manager'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Shared assets in {conversationName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 px-6 py-3 dark:border-white/10">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-[#060714]">
            <button
              type="button"
              onClick={() => setTab('gallery')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'gallery'
                  ? 'bg-white text-slate-950 shadow-xs dark:bg-violet-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Media Gallery ({galleryItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('files')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'files'
                  ? 'bg-white text-slate-950 shadow-xs dark:bg-violet-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>
                File Manager (
                {items.filter((m) => m.mediaType === 'document' || m.mediaType === 'audio').length})
              </span>
            </button>
          </div>

          {tab === 'files' && (
            <div className="relative w-52">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter files..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-violet-600 focus:outline-none dark:border-white/15 dark:bg-[#060714] dark:text-white"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading shared media metadata...
            </p>
          ) : tab === 'gallery' ? (
            galleryItems.length === 0 ? (
              <div className="py-12 text-center">
                <ImageIcon className="mx-auto h-9 w-9 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No images or videos shared here yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Upload JPG, PNG, WEBP, MP4, or WEBM files in chat to populate this gallery.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {galleryItems.map((media) => {
                  const srcUrl = withAuthToken(media.url, authToken);
                  const dlUrl = withAuthToken(media.downloadUrl, authToken);
                  return (
                    <div
                      key={media.id}
                      className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#060714]"
                    >
                      <div className="relative aspect-video bg-slate-900">
                        {media.mediaType === 'image' ? (
                          <img
                            src={srcUrl}
                            alt={media.originalFilename}
                            referrerPolicy="no-referrer"
                            onClick={() => onOpenLightbox(media)}
                            className="h-full w-full cursor-zoom-in object-cover"
                          />
                        ) : (
                          <video src={srcUrl} controls className="h-full w-full object-cover" />
                        )}
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-950/75 px-1.5 py-0.5 font-mono text-[10px] text-white">
                          {media.mediaType === 'video' ? (
                            <Film className="h-3 w-3" />
                          ) : (
                            <ImageIcon className="h-3 w-3" />
                          )}
                          {media.extension}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {media.originalFilename}
                          </p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {media.uploaderUsername} · {formatBytes(media.sizeBytes)}
                          </p>
                        </div>
                        <a
                          href={dlUrl}
                          download={media.originalFilename}
                          aria-label={`Download ${media.originalFilename}`}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : fileItems.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="mx-auto h-9 w-9 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                No documents or audio files found
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Shared PDF, DOCX, TXT, PPTX, XLSX, MP3, WAV, and voice clips appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {fileItems.map((media) => {
                const dlUrl = withAuthToken(media.downloadUrl, authToken);
                return (
                  <div
                    key={media.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-cyan-400">
                        {media.mediaType === 'audio' ? (
                          <Music className="h-5 w-5" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {media.originalFilename}
                        </p>
                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {media.extension} · {formatBytes(media.sizeBytes)}
                          {media.durationSec ? ` · ${formatDuration(media.durationSec)}` : ''} · By{' '}
                          {media.uploaderUsername}
                        </p>
                      </div>
                    </div>
                    <a
                      href={dlUrl}
                      download={media.originalFilename}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
