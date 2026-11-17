import { useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import type { AppPage } from '../types/chat';

interface NavbarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isLoggedIn: boolean;
}

const NAV_ITEMS: { id: AppPage; label: string }[] = [
  { id: 'landing', label: 'Overview' },
  { id: 'chat', label: 'Chat Room' },
  { id: 'networks', label: 'Network Visualizer' },
  { id: 'docs', label: 'Documentation' },
];

export function Navbar({
  currentPage,
  onNavigate,
  isDark,
  onToggleTheme,
  isLoggedIn,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (page: AppPage) => {
    if (page === 'chat' && !isLoggedIn) {
      onNavigate('login');
    } else {
      onNavigate(page);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-violet-500/15 dark:bg-[#060714]/80">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5 lg:px-10">
        {/* Zone 1: Single clean text wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('landing')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 dark:text-white"
        >
          TCPChat
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive =
              currentPage === item.id || (item.id === 'chat' && currentPage === 'login');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 ${
                  isActive
                    ? 'text-violet-700 dark:text-cyan-300'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme toggle + 1 primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white/80 text-slate-700 transition-all duration-150 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-violet-500/25 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-violet-600" />}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick(isLoggedIn ? 'chat' : 'login')}
            className="hidden sm:inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 shadow-md shadow-violet-600/25 transition-all duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          >
            {isLoggedIn ? 'Open Chat' : 'Start Chatting'}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-700 md:hidden dark:border-violet-500/25 dark:bg-slate-900/70 dark:text-slate-200"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-xl md:hidden dark:border-violet-500/15 dark:bg-[#060714]/95">
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive =
                currentPage === item.id || (item.id === 'chat' && currentPage === 'login');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-cyan-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleNavClick(isLoggedIn ? 'chat' : 'login')}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25"
            >
              {isLoggedIn ? 'Open Chat' : 'Start Chatting'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
