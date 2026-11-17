import { useState } from 'react';
import type { UserPresence } from '../types/chat';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  presence?: UserPresence;
  showPresence?: boolean;
  animatedRing?: boolean;
  onClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

const PRESENCE_DOT: Record<UserPresence, string> = {
  online: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]',
  available: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]',
  working: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)]',
  busy: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
  gaming: 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.85)]',
  away: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]',
  offline: 'bg-slate-400',
};

export function Avatar({
  name,
  avatarUrl,
  color = '#7C3AED',
  size = 'md',
  presence = 'offline',
  showPresence = false,
  animatedRing = false,
  onClick,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  const isLive = presence !== 'offline';

  const content = (
    <div className="relative inline-flex shrink-0">
      {animatedRing && isLive && (
        <span
          aria-hidden="true"
          className="animate-pulse-ring pointer-events-none absolute -inset-0.5 rounded-xl border border-violet-500/50 dark:border-cyan-400/50"
        />
      )}

      {avatarUrl && !imgFailed ? (
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${SIZE_CLASSES[size]} rounded-xl object-cover ring-1 ring-black/10 transition-transform duration-150 dark:ring-white/15 ${
            onClick ? 'group-hover:scale-105' : ''
          }`}
        />
      ) : (
        <div
          style={{
            background: `linear-gradient(135deg, ${color}, #2563EB)`,
          }}
          className={`${SIZE_CLASSES[size]} flex items-center justify-center rounded-xl font-display font-bold text-white shadow-sm ring-1 ring-white/15 transition-transform duration-150 ${
            onClick ? 'hover:scale-105' : ''
          }`}
        >
          {initials || 'U'}
        </div>
      )}

      {showPresence && (
        <span
          aria-label={`Status: ${presence}`}
          title={`Mood: ${presence}`}
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#0c0e1d] ${PRESENCE_DOT[presence]}`}
        />
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title={`View ${name}'s profile card`}
        className="group inline-flex shrink-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
      >
        {content}
      </button>
    );
  }

  return content;
}
