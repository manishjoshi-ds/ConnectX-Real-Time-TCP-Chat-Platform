import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Cpu,
  Globe,
  Lock,
  Mic,
  Network,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import heroTcpNetworkImg from '../assets/images/hero_tcp_network_1794588551852.jpg';
import type { AppPage } from '../types/chat';

interface LandingPageProps {
  onNavigate: (page: AppPage) => void;
  onlineCount: number;
  isLoggedIn: boolean;
}

interface DemoExchange {
  id: number;
  sender: string;
  role: string;
  color: string;
  channel: string;
  text: string;
  isPrivate?: boolean;
  reaction?: string;
}

const DEMO_SCRIPT: DemoExchange[] = [
  {
    id: 1,
    sender: 'Rahul',
    role: 'Client A · Working',
    color: 'from-violet-600 to-blue-600',
    channel: 'Common Chat Room',
    text: 'Connected over WebSocket/TCP! Uploading our lab report PDF now.',
    reaction: '🚀 2',
  },
  {
    id: 2,
    sender: 'Aman',
    role: 'Client B · Available',
    color: 'from-cyan-500 to-blue-600',
    channel: 'Common Chat Room',
    text: 'Received instantly! Also sent the topology diagram to Media Gallery.',
    reaction: '🔥 3',
  },
  {
    id: 3,
    sender: 'Priya',
    role: 'Client C · Direct DM',
    color: 'from-fuchsia-600 to-violet-600',
    channel: 'Private DM -> Rahul',
    text: 'Hey Rahul, I pinned the final Socket.IO notes in our spotlight!',
    isPrivate: true,
    reaction: '🎉 2',
  },
];

const FEATURES = [
  {
    index: '01',
    title: 'Concurrent Multi-Client TCP Broadcast',
    description:
      'Connect multiple browser tabs or devices simultaneously. Public messages, voice notes, and media frames fan out across every active Socket.IO session in real time.',
    span: 'lg:col-span-2',
    accent: 'from-violet-500/20 to-blue-500/20',
  },
  {
    index: '02',
    title: 'Private 1:1 & Group Channels',
    description:
      'Launch confidential one-to-one sockets or create moderated multi-user groups with participant management, unread counters, and read receipts.',
    span: 'lg:col-span-1',
    accent: 'from-cyan-500/20 to-blue-500/20',
  },
  {
    index: '03',
    title: 'Rich Media, Voice Clips & Document Sharing',
    description:
      'Share images with full-screen lightbox, stream MP4/WEBM videos, exchange PDF/DOCX/PPTX/XLSX files, and record live audio waveforms directly in chat.',
    span: 'lg:col-span-1',
    accent: 'from-fuchsia-500/20 to-purple-500/20',
  },
  {
    index: '04',
    title: 'Live Network Topology Visualizer',
    description:
      'Inspect real packet routing between connected clients and the central TCP server in real time as messages, typing states, and joins happen.',
    span: 'lg:col-span-2',
    accent: 'from-blue-500/20 to-cyan-500/20',
  },
];

const TECH_STACK = [
  {
    icon: Globe,
    title: 'Futuristic Frontend',
    detail:
      'React, TypeScript, Tailwind CSS glassmorphism, Motion transitions, Canvas particle backdrops, and Web Audio sound synthesis.',
    stack: 'HTML5 · CSS3 · TypeScript · Dual Themes',
  },
  {
    icon: Server,
    title: 'Concurrent Backend',
    detail:
      'Event-driven Socket.IO server with SQLite WAL persistence, Multer multipart streaming, plus a complete Python Flask-SocketIO package.',
    stack: 'Python · Flask · Flask-SocketIO · Simple-WebSocket',
  },
  {
    icon: Cpu,
    title: 'TCP Transport Engine',
    detail:
      'Full-duplex WebSocket frames upgraded over reliable TCP sockets, preserving packet order, heartbeats, and instant disconnect cleanup.',
    stack: 'Socket.IO · RFC 6455 WebSocket · TCP/IP',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01. TCP 3-Way Handshake',
    detail:
      'Browser initiates a connection-oriented TCP session with the central server via SYN, SYN-ACK, and ACK.',
  },
  {
    step: '02. WebSocket Upgrade',
    detail:
      'HTTP 101 Switching Protocols promotes the TCP socket into a persistent full-duplex WebSocket tunnel.',
  },
  {
    step: '03. Session Registration',
    detail:
      'The server validates unique usernames, assigns an auth token and Socket ID, and syncs live presence.',
  },
  {
    step: '04. Selective Routing',
    detail:
      'Public messages broadcast to everyone, while DMs and groups emit solely to authorized member sockets.',
  },
];

export function LandingPage({ onNavigate, onlineCount, isLoggedIn }: LandingPageProps) {
  const [imgError, setImgError] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDemoStep((prev) => (prev + 1) % 3);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const visibleDemoMessages = DEMO_SCRIPT.slice(0, demoStep + 1);
  const activeSender = DEMO_SCRIPT[demoStep]?.sender || 'Rahul';

  return (
    <div className="relative z-10 text-slate-900 dark:text-slate-100">
      {/* Hero Section */}
      <section className="mx-auto max-w-[1440px] px-6 pb-14 pt-10 lg:px-10 lg:pt-16">
        <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
          {/* Left Hero Column */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-between lg:col-span-6"
          >
            <div>
              <p className="text-sm font-semibold text-violet-700 dark:text-cyan-300">
                Computer Networks Platform · Full-Duplex Socket Architecture
              </p>

              <h1
                className="mt-4 font-display font-bold tracking-tight text-slate-950 dark:text-white"
                style={{
                  fontSize: 'clamp(2.35rem, 4.2vw, 3.85rem)',
                  lineHeight: 1.06,
                  textWrap: 'balance',
                }}
              >
                Multi-Client Chat Application{' '}
                <span className="animate-gradient-shift bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                  Using TCP
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Experience real-time bidirectional messaging powered by WebSocket transport over TCP.
                Join common channels, send encrypted-feel private DMs, collaborate in groups, share
                voice clips and media, and watch live packets route across the network.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate(isLoggedIn ? 'chat' : 'login')}
                className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 shadow-lg shadow-violet-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
              >
                <span>{isLoggedIn ? 'Open Chat Studio' : 'Start Chatting'}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('networks')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300/90 bg-white/80 px-5 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap shrink-0 backdrop-blur-md transition-all duration-150 hover:border-violet-400 hover:bg-violet-50/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-violet-500/30 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-cyan-400/60 dark:hover:bg-slate-800/80"
              >
                <Activity className="h-4 w-4 text-violet-600 dark:text-cyan-400" />
                <span>Open Network Visualizer</span>
              </button>
            </div>
          </motion.div>

          {/* Right Hero Column: Interactive 3D-Perspective Topology + Live 3-User Animated Demo */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-xl shadow-violet-950/5 backdrop-blur-xl dark:border-violet-500/25 dark:bg-[#0b0e23]/80 dark:shadow-violet-950/40">
              {/* Top Interactive 3D-Perspective Node Graph + Illustration Header */}
              <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-950 dark:border-violet-500/25">
                {!imgError ? (
                  <img
                    src={heroTcpNetworkImg}
                    alt="Connected client nodes routing real-time messages through a central TCP server"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="h-44 w-full object-cover opacity-80"
                  />
                ) : (
                  <div className="h-44 w-full bg-gradient-to-br from-[#0b0f2a] via-[#15123b] to-[#0b1f33]" />
                )}

                {/* Animated SVG Overlay Nodes Connected by Animated Lines */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#060714]/90 via-[#060714]/35 to-transparent" />
                <svg
                  viewBox="0 0 520 176"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <line
                    x1="88"
                    y1="54"
                    x2="260"
                    y2="88"
                    stroke={activeSender === 'Rahul' ? '#22D3EE' : 'rgba(139,92,246,0.55)'}
                    strokeWidth={activeSender === 'Rahul' ? '2.5' : '1.5'}
                    strokeDasharray="6 4"
                  />
                  <line
                    x1="88"
                    y1="132"
                    x2="260"
                    y2="88"
                    stroke={activeSender === 'Aman' ? '#22D3EE' : 'rgba(59,130,246,0.55)'}
                    strokeWidth={activeSender === 'Aman' ? '2.5' : '1.5'}
                    strokeDasharray="6 4"
                  />
                  <line
                    x1="432"
                    y1="88"
                    x2="260"
                    y2="88"
                    stroke={activeSender === 'Priya' ? '#C084FC' : 'rgba(6,182,212,0.55)'}
                    strokeWidth={activeSender === 'Priya' ? '2.5' : '1.5'}
                    strokeDasharray="6 4"
                  />

                  {/* Moving packet pulse */}
                  <circle
                    cx={activeSender === 'Rahul' ? 174 : activeSender === 'Aman' ? 174 : 346}
                    cy={activeSender === 'Rahul' ? 71 : activeSender === 'Aman' ? 110 : 88}
                    r="5"
                    fill="#22D3EE"
                  />

                  {/* Client Nodes */}
                  <g transform="translate(36, 36)">
                    <rect width="104" height="34" rx="9" fill="rgba(15,23,42,0.85)" stroke="#8B5CF6" />
                    <text x="52" y="21" textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="600">
                      Rahul
                    </text>
                  </g>
                  <g transform="translate(36, 114)">
                    <rect width="104" height="34" rx="9" fill="rgba(15,23,42,0.85)" stroke="#3B82F6" />
                    <text x="52" y="21" textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="600">
                      Aman
                    </text>
                  </g>
                  <g transform="translate(198, 66)">
                    <rect width="124" height="44" rx="11" fill="rgba(109,40,217,0.9)" stroke="#22D3EE" />
                    <text x="62" y="26" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="700">
                      TCP Server
                    </text>
                  </g>
                  <g transform="translate(380, 71)">
                    <rect width="104" height="34" rx="9" fill="rgba(15,23,42,0.85)" stroke="#06B6D4" />
                    <text x="52" y="21" textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="600">
                      Priya
                    </text>
                  </g>
                </svg>
              </div>

              {/* Live Animated 3-User Message Demonstration */}
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Live Multi-Client Exchange Preview
                  </span>
                  <span className="font-mono text-[11px] text-violet-600 dark:text-cyan-300">
                    3 Connected Peers · Rahul, Aman, Priya
                  </span>
                </div>

                <div className="min-h-[188px] space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3 dark:border-violet-500/20 dark:bg-[#060714]/70">
                  <AnimatePresence initial={false}>
                    {visibleDemoMessages.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-xs dark:border-white/10 dark:bg-slate-900/85"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${m.color} font-display text-xs font-bold text-white`}
                        >
                          {m.sender.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {m.sender}{' '}
                              <span className="font-normal text-slate-500 dark:text-slate-400">
                                · {m.role}
                              </span>
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[10px] ${
                                m.isPrivate
                                  ? 'text-violet-600 dark:text-cyan-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {m.isPrivate && <Lock className="h-2.5 w-2.5" />}
                              {m.channel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                            {m.text}
                          </p>
                        </div>
                        {m.reaction && (
                          <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-300">
                            {m.reaction}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Full-Width 4-Column Specification Strip */}
        <div className="mt-10 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/90 bg-white/80 p-6 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4 dark:border-violet-500/20 dark:bg-[#0b0e23]/75">
          <div className="flex items-start gap-3">
            <Network className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-cyan-400" />
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Transport Layer
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                WebSocket over TCP
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Live Connected Clients
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {onlineCount} Active {onlineCount === 1 ? 'User' : 'Users'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mic className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Rich Collaboration
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                Media · Voice · Groups
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Server Validation
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                SQLite WAL · Auth Tokens
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Bento Grid */}
      <section className="border-t border-slate-200/80 bg-white/60 py-16 backdrop-blur-md dark:border-violet-500/15 dark:bg-[#090b1b]/65">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              Built for Modern Real-Time Collaboration
            </h2>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
              Every control, message stream, voice recorder, and network packet trace runs against
              a live multi-client Socket.IO server backed by SQLite persistence.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {FEATURES.map((feat) => (
              <motion.article
                key={feat.index}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className={`${feat.span} relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/85 p-6 shadow-sm backdrop-blur-xl transition-colors hover:border-violet-400/70 dark:border-violet-500/20 dark:bg-[#0e1129]/85 dark:hover:border-cyan-400/50`}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${feat.accent} blur-2xl`}
                />
                <p className="font-mono text-xs font-semibold text-violet-600 dark:text-cyan-300">
                  {feat.index}
                </p>
                <h3 className="mt-2 font-display text-lg font-bold text-slate-950 dark:text-white">
                  {feat.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {feat.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 lg:px-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              Architecture & Technology Stack
            </h2>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
              Clean separation across futuristic presentation, concurrent socket handling, and TCP transport.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('docs')}
            className="text-sm font-semibold text-violet-700 hover:underline dark:text-cyan-300"
          >
            Inspect Python Flask-SocketIO Source
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TECH_STACK.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.16 }}
                className="rounded-2xl border border-slate-200/90 bg-white/85 p-6 backdrop-blur-xl dark:border-violet-500/20 dark:bg-[#0e1129]/85"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-md shadow-violet-600/20">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-slate-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.detail}
                </p>
                <div className="mt-4 border-t border-slate-200/80 pt-3 font-mono text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {item.stack}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-slate-200/80 bg-white/60 py-16 backdrop-blur-md dark:border-violet-500/15 dark:bg-[#090b1b]/65">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            How TCP Socket Communication Works
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-slate-200/90 bg-white/85 p-6 backdrop-blur-xl dark:border-violet-500/20 dark:bg-[#0e1129]/85"
              >
                <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
                  {item.step}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/80 py-10 backdrop-blur-xl dark:border-violet-500/15 dark:bg-[#060714]/90">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center lg:px-10">
          <div>
            <p className="font-display text-base font-bold text-slate-950 dark:text-white">
              Multi-Client Chat Application Using TCP
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              B.Tech Computer Networks Project · Real-Time Socket Communication Platform
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="hover:text-violet-700 dark:hover:text-cyan-300"
            >
              Join Chat
            </button>
            <button
              type="button"
              onClick={() => onNavigate('networks')}
              className="hover:text-violet-700 dark:hover:text-cyan-300"
            >
              Network Visualizer
            </button>
            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="hover:text-violet-700 dark:hover:text-cyan-300"
            >
              Academic Report
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
