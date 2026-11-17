import { AlertCircle, Bell, FileUp, MessageSquare, Users, X } from 'lucide-react';
import type { AppNotification } from '../types/chat';

interface ToastContainerProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ToastContainer({
  notifications,
  onDismiss,
  onSelectConversation,
}: ToastContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
    >
      {notifications.map((item) => {
        const Icon =
          item.kind === 'error'
            ? AlertCircle
            : item.kind === 'media'
              ? FileUp
              : item.kind === 'group'
                ? Users
                : item.kind === 'message'
                  ? MessageSquare
                  : Bell;

        const isError = item.kind === 'error';

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
              isError
                ? 'border-rose-300/80 bg-rose-50/95 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/90 dark:text-rose-100'
                : 'border-violet-200/80 bg-white/90 text-slate-900 shadow-violet-500/10 dark:border-violet-500/30 dark:bg-[#0d0f26]/90 dark:text-slate-100 dark:shadow-violet-950/40'
            }`}
          >
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                isError ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-cyan-400'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                if (item.conversationId) {
                  onSelectConversation(item.conversationId);
                }
                onDismiss(item.id);
              }}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-xs font-bold">{item.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{item.body}</p>
            </button>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
