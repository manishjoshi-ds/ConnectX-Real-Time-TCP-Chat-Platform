import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronUp, Plus, X } from 'lucide-react';
import { QUICK_EMOJIS } from '../utils/format';

interface ReactionPickerProps {
  messageId: string;
  selectedEmojis: string[];
  align?: 'left' | 'right';
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const REACTION_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Popular',
    emojis: ['❤️', '🔥', '👍', '😂', '😮', '😢', '🎉', '👏'],
  },
  {
    label: 'Tech & Praise',
    emojis: ['🚀', '💡', '✅', '⚡', '💯', '🧠', '🛠️', '✨'],
  },
  {
    label: 'Expressions',
    emojis: ['🙌', '😎', '🤔', '👀', '🥳', '🤝', '🫡', '💜'],
  },
];

const QUICK_ROW = ['❤️', '🔥', '👍', '😂', '😮', '🎉', '👏', '🚀'];

export function ReactionPicker({
  messageId,
  selectedEmojis,
  align = 'left',
  onSelect,
  onClose,
}: ReactionPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(`[data-reaction-trigger="${messageId}"]`)) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [messageId, onClose]);

  const selectedSet = new Set(selectedEmojis);

  return (
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-label="Emoji reaction picker"
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 4 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      className={`mt-1.5 w-max max-w-[280px] rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-xl shadow-violet-950/15 backdrop-blur-xl dark:border-violet-500/30 dark:bg-[#0d1026]/95 dark:shadow-black/50 ${
        align === 'right' ? 'self-end' : 'self-start'
      }`}
    >
      {/* Quick Reaction Bar */}
      <div className="flex items-center gap-1">
        {QUICK_ROW.map((emoji) => {
          const isSelected = selectedSet.has(emoji);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              aria-label={`React with ${emoji}`}
              aria-pressed={isSelected}
              className={`flex h-8 w-8 items-center justify-center rounded-xl text-base transition-all hover:scale-120 active:scale-95 ${
                isSelected
                  ? 'bg-violet-100 ring-1 ring-violet-500 dark:bg-violet-500/30 dark:ring-cyan-400'
                  : 'hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {emoji}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? 'Show fewer reactions' : 'Show more reactions'}
          title={expanded ? 'Collapse emoji palette' : 'More emojis'}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition-colors hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:bg-white/10 dark:hover:text-cyan-300"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded Categorized Emoji Grid */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-slate-200/80 pt-2 dark:border-white/10">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              All Reactions ({QUICK_EMOJIS.length}+)
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close reaction picker"
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {REACTION_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
              <div className="mt-1 grid grid-cols-8 gap-1">
                {group.emojis.map((emoji) => {
                  const isSelected = selectedSet.has(emoji);
                  return (
                    <button
                      key={`${group.label}-${emoji}`}
                      type="button"
                      onClick={() => onSelect(emoji)}
                      aria-label={`React with ${emoji}`}
                      aria-pressed={isSelected}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-transform hover:scale-120 active:scale-95 ${
                        isSelected
                          ? 'bg-violet-100 ring-1 ring-violet-500 dark:bg-violet-500/30 dark:ring-cyan-400'
                          : 'hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
