import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Users, WifiOff } from 'lucide-react';
import type { ConnectionStatus, UserPresence } from '../types/chat';
import { MOOD_CONFIGS } from '../utils/format';

interface LoginPageProps {
  onJoin: (username: string, mood: UserPresence) => void;
  error: string;
  isJoining: boolean;
  connectionStatus: ConnectionStatus;
  onlineCount: number;
  onClearError: () => void;
}

const ENTRY_MOODS: UserPresence[] = ['available', 'working', 'busy', 'gaming', 'away'];

export function LoginPage({
  onJoin,
  error,
  isJoining,
  connectionStatus,
  onlineCount,
  onClearError,
}: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [mood, setMood] = useState<UserPresence>('available');
  const [localError, setLocalError] = useState('');

  const activeError = localError || error;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      setLocalError('Please enter a username before joining the chat room.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 24) {
      setLocalError('Username must be between 2 and 24 characters.');
      return;
    }
    if (!/^[A-Za-z0-9_ -]{2,24}$/.test(trimmed)) {
      setLocalError('Use only letters, numbers, spaces, hyphens, or underscores.');
      return;
    }
    setLocalError('');
    onJoin(trimmed, mood);
  };

  return (
    <div className="relative z-10 min-h-[calc(100vh-69px)] px-6 py-12">
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-slate-200/90 bg-white/85 p-8 shadow-xl shadow-violet-950/5 backdrop-blur-xl lg:col-span-7 dark:border-violet-500/25 dark:bg-[#0b0e23]/85"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-violet-500/15">
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
              Join Chat Studio
            </h1>
            <div className="flex items-center gap-2 text-xs font-medium">
              {connectionStatus === 'connected' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    WebSocket · TCP Ready
                  </span>
                </>
              )}
              {connectionStatus === 'connecting' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-400">Connecting...</span>
                </>
              )}
              {connectionStatus === 'disconnected' && (
                <>
                  <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-red-700 dark:text-red-400">Disconnected</span>
                </>
              )}
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Enter a unique username to establish your persistent TCP socket session. Duplicate
            active usernames are automatically rejected by the server.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="username-input"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Username
              </label>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (localError) setLocalError('');
                  if (error) onClearError();
                }}
                placeholder="e.g., Rahul, Aman, or Priya"
                maxLength={24}
                autoFocus
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-slate-300/90 bg-slate-50/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:outline-none dark:border-violet-500/25 dark:bg-[#060714]/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400"
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                2–24 characters · Letters, numbers, spaces, hyphens, or underscores
              </p>
            </div>

            {/* Chat Mood Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Initial Chat Mood
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ENTRY_MOODS.map((m) => {
                  const cfg = MOOD_CONFIGS[m];
                  const selected = mood === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(m)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                        selected
                          ? 'border-violet-600 bg-violet-50 text-violet-800 shadow-xs dark:border-cyan-400 dark:bg-violet-950/60 dark:text-cyan-200'
                          : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{activeError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining || connectionStatus !== 'connected'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isJoining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Establishing Socket Session...</span>
                </>
              ) : (
                <>
                  <span>Join Chat</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Side Info Panel */}
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/85 p-8 backdrop-blur-xl lg:col-span-5 dark:border-violet-500/25 dark:bg-[#0b0e23]/85"
        >
          <div>
            <div className="flex items-center gap-2.5 text-slate-950 dark:text-white">
              <Users className="h-5 w-5 text-violet-600 dark:text-cyan-400" />
              <h2 className="font-display text-lg font-bold">Live Room Status</h2>
            </div>
            <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-slate-950 dark:text-white">
              {onlineCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Currently connected {onlineCount === 1 ? 'client' : 'clients'} on the server
            </p>

            <div className="mt-6 border-t border-slate-200/80 pt-5 dark:border-violet-500/15">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                Multi-Client Demonstration Guide
              </h3>
              <ol className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                <li>1. Join this tab as Rahul.</li>
                <li>2. Open a second browser tab and join as Aman.</li>
                <li>3. Open a third tab and join as Priya.</li>
                <li>
                  4. Test common room broadcasts, 1-to-1 private DMs, voice clips, media sharing, and
                  live packet flow in the Network Visualizer.
                </li>
              </ol>
            </div>
          </div>

          <p className="mt-6 border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-violet-500/15 dark:text-slate-400">
            Session identity is tied to your active Socket.IO connection ID and cleared automatically
            on logout or disconnect.
          </p>
        </motion.aside>
      </div>
    </div>
  );
}
