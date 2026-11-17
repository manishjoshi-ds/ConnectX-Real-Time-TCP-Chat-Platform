import type { ChatThemeId, UserPresence } from '../types/chat';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatLastActive(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function withAuthToken(url: string, authToken: string): string {
  if (!url || !authToken) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(authToken)}`;
}

export const QUICK_EMOJIS = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '🔥',
  '🎉',
  '👏',
  '🚀',
  '💡',
  '✅',
  '🙌',
  '😎',
  '🤔',
  '👀',
  '💯',
  '⚡',
];

export const PROFILE_COLORS = [
  '#7C3AED', // Electric Purple
  '#2563EB', // Neon Blue
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Sunset Amber
  '#EC4899', // Magenta Rose
  '#6366F1', // Indigo
  '#EF4444', // Crimson
];

export interface MoodConfig {
  id: UserPresence;
  label: string;
  dotClass: string;
  textClass: string;
}

export const MOOD_CONFIGS: Record<UserPresence, MoodConfig> = {
  online: {
    id: 'online',
    label: 'Available',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  available: {
    id: 'available',
    label: 'Available',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  working: {
    id: 'working',
    label: 'Working',
    dotClass: 'bg-cyan-500',
    textClass: 'text-cyan-600 dark:text-cyan-400',
  },
  busy: {
    id: 'busy',
    label: 'Busy',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
  gaming: {
    id: 'gaming',
    label: 'Gaming',
    dotClass: 'bg-violet-500',
    textClass: 'text-violet-600 dark:text-violet-400',
  },
  away: {
    id: 'away',
    label: 'Away',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  offline: {
    id: 'offline',
    label: 'Offline',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-500 dark:text-slate-400',
  },
};

export interface ChatThemeConfig {
  id: ChatThemeId;
  name: string;
  description: string;
  swatchClass: string;
  canvasClass: string;
  ownBubbleClass: string;
  otherBubbleClass: string;
  accentRingClass: string;
}

export const CHAT_THEMES: Record<ChatThemeId, ChatThemeConfig> = {
  'midnight-purple': {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    description: 'Deep midnight glass canvas with electric purple & indigo gradients',
    swatchClass: 'from-violet-600 via-purple-600 to-blue-600',
    canvasClass:
      'bg-gradient-to-br from-slate-50 via-violet-50/40 to-indigo-50/50 dark:from-[#060714] dark:via-[#0d0c24] dark:to-[#120d2e]',
    ownBubbleClass:
      'bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 text-white border-violet-400/30 shadow-md shadow-violet-950/20',
    otherBubbleClass:
      'bg-white/90 dark:bg-slate-900/75 backdrop-blur-xl text-slate-900 dark:text-slate-100 border-violet-200/70 dark:border-violet-500/20',
    accentRingClass: 'focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/25',
  },
  'cyber-blue': {
    id: 'cyber-blue',
    name: 'Cyber Blue',
    description: 'Neon blue and cyan highlights over deep oceanic slate',
    swatchClass: 'from-blue-600 via-sky-500 to-cyan-500',
    canvasClass:
      'bg-gradient-to-br from-sky-50/70 via-white to-cyan-50/60 dark:from-[#050a18] dark:via-[#081329] dark:to-[#071c2b]',
    ownBubbleClass:
      'bg-gradient-to-br from-blue-600 to-cyan-500 text-white border-cyan-400/35 shadow-md shadow-blue-950/20',
    otherBubbleClass:
      'bg-white/90 dark:bg-slate-900/75 backdrop-blur-xl text-slate-900 dark:text-slate-100 border-sky-200/70 dark:border-cyan-500/20',
    accentRingClass: 'focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/25',
  },
  'neon-green': {
    id: 'neon-green',
    name: 'Neon Green',
    description: 'High-contrast emerald matrix glow for terminal & network clarity',
    swatchClass: 'from-emerald-500 via-teal-500 to-cyan-500',
    canvasClass:
      'bg-gradient-to-br from-emerald-50/50 via-slate-50 to-teal-50/50 dark:from-[#040d0b] dark:via-[#071715] dark:to-[#061c18]',
    ownBubbleClass:
      'bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-emerald-400/35 shadow-md shadow-emerald-950/20',
    otherBubbleClass:
      'bg-white/90 dark:bg-slate-900/75 backdrop-blur-xl text-slate-900 dark:text-slate-100 border-emerald-200/70 dark:border-emerald-500/20',
    accentRingClass: 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25',
  },
  'sunset-orange': {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    description: 'Warm amber-coral dusk gradient with clean contrast',
    swatchClass: 'from-orange-500 via-rose-500 to-amber-500',
    canvasClass:
      'bg-gradient-to-br from-amber-50/60 via-white to-rose-50/40 dark:from-[#120907] dark:via-[#1b0e12] dark:to-[#170c08]',
    ownBubbleClass:
      'bg-gradient-to-br from-orange-600 via-rose-600 to-amber-600 text-white border-orange-400/35 shadow-md shadow-orange-950/20',
    otherBubbleClass:
      'bg-white/90 dark:bg-slate-900/75 backdrop-blur-xl text-slate-900 dark:text-slate-100 border-amber-200/70 dark:border-orange-500/20',
    accentRingClass: 'focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/25',
  },
  'minimal-light': {
    id: 'minimal-light',
    name: 'Minimal Light',
    description: 'Ultra-clean lavender-slate glass canvas with crisp typography',
    swatchClass: 'from-slate-600 via-indigo-500 to-slate-400',
    canvasClass:
      'bg-gradient-to-br from-slate-50 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900',
    ownBubbleClass:
      'bg-gradient-to-br from-indigo-600 to-blue-600 text-white border-indigo-400/30 shadow-sm',
    otherBubbleClass:
      'bg-white dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700',
    accentRingClass: 'focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20',
  },
};

export function resolveChatTheme(id?: string | null): ChatThemeConfig {
  if (id && id in CHAT_THEMES) {
    return CHAT_THEMES[id as ChatThemeId];
  }
  return CHAT_THEMES['midnight-purple'];
}
