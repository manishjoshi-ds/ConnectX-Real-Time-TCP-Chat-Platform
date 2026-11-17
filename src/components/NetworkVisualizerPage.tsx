import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Play,
  Radio,
  RotateCcw,
  Send,
  Server,
  Users,
} from 'lucide-react';
import type { ConnectionStatus, NetworkPacketEvent, UserProfile } from '../types/chat';
import { MOOD_CONFIGS } from '../utils/format';

interface NetworkVisualizerPageProps {
  directory: UserProfile[];
  currentUser: string;
  connectionStatus: ConnectionStatus;
  recentPackets: NetworkPacketEvent[];
  onPingNetwork: () => void;
}

type ScenarioId = 'handshake' | 'upgrade' | 'broadcast' | 'private' | 'disconnect';

interface SimulationStep {
  label: string;
  from: 'clientA' | 'server' | 'clientB' | 'clientC';
  to: 'clientA' | 'server' | 'clientB' | 'clientC' | 'all';
  packet: string;
  explanation: string;
}

const SCENARIOS: { id: ScenarioId; title: string; steps: SimulationStep[] }[] = [
  {
    id: 'handshake',
    title: '01. TCP 3-Way Handshake',
    steps: [
      {
        label: 'SYN Packet',
        from: 'clientA',
        to: 'server',
        packet: 'TCP SYN (seq=100)',
        explanation:
          'Client A (Rahul) sends a SYN segment to the server port to request a reliable ordered byte-stream connection.',
      },
      {
        label: 'SYN-ACK Reply',
        from: 'server',
        to: 'clientA',
        packet: 'TCP SYN-ACK (seq=300, ack=101)',
        explanation:
          'The OS TCP stack on the server acknowledges Rahul’s sequence number and sends its own initial sequence number.',
      },
      {
        label: 'ACK Established',
        from: 'clientA',
        to: 'server',
        packet: 'TCP ACK (ack=301)',
        explanation:
          'Client A confirms receipt. A full-duplex reliable TCP socket connection is now established.',
      },
    ],
  },
  {
    id: 'upgrade',
    title: '02. WebSocket Upgrade',
    steps: [
      {
        label: 'HTTP Upgrade Request',
        from: 'clientA',
        to: 'server',
        packet: 'GET /socket.io/ Upgrade: websocket',
        explanation:
          'Over the established TCP socket, the browser requests an HTTP 101 Switching Protocols upgrade to WebSocket.',
      },
      {
        label: '101 Switching Protocols',
        from: 'server',
        to: 'clientA',
        packet: 'HTTP/1.1 101 Switching Protocols',
        explanation:
          'The server accepts the upgrade. Both endpoints keep the underlying TCP socket open for low-overhead bidirectional WebSocket frames.',
      },
    ],
  },
  {
    id: 'broadcast',
    title: '03. Public Room Broadcast',
    steps: [
      {
        label: 'Emit Public Message',
        from: 'clientA',
        to: 'server',
        packet: 'EVENT send_message {"conversationId": "public"}',
        explanation:
          'Rahul sends a public chat event over his WebSocket/TCP connection to the central server.',
      },
      {
        label: 'Server Broadcast',
        from: 'server',
        to: 'all',
        packet: 'BROADCAST new_message -> Rahul, Aman, Priya',
        explanation:
          'The server validates the payload, stores it in SQLite, and writes the frame to every connected client socket.',
      },
    ],
  },
  {
    id: 'private',
    title: '04. Private 1:1 Routing',
    steps: [
      {
        label: 'Emit Private Event',
        from: 'clientA',
        to: 'server',
        packet: 'EVENT send_message {"to": "Priya"}',
        explanation:
          'Rahul selects Priya in the sidebar and sends a private message. It travels first to the central server (client-server topology).',
      },
      {
        label: 'Targeted Socket Dispatch',
        from: 'server',
        to: 'clientC',
        packet: 'TARGETED EMIT -> Priya (sid_priya) + Echo Rahul',
        explanation:
          'The server looks up Priya’s socket ID in its synchronized user table and emits solely to Priya and Rahul. Aman never receives this packet.',
      },
    ],
  },
  {
    id: 'disconnect',
    title: '05. Disconnect Cleanup',
    steps: [
      {
        label: 'TCP FIN / Heartbeat Timeout',
        from: 'clientB',
        to: 'server',
        packet: 'TCP FIN / Socket disconnect',
        explanation:
          'When Aman logs out or closes his browser tab unexpectedly, the TCP FIN packet or missed ping heartbeat alerts the server.',
      },
      {
        label: 'State Removal & Notify',
        from: 'server',
        to: 'all',
        packet: 'BROADCAST users_update + departure notice',
        explanation:
          'The server marks Aman offline and broadcasts the updated online users list to Rahul and Priya.',
      },
    ],
  },
];

const NETWORK_TOPICS = [
  {
    q: '01. What is TCP (Transmission Control Protocol)?',
    a: 'TCP is a connection-oriented, reliable transport-layer protocol in the TCP/IP suite. Before exchanging application data, TCP establishes a virtual circuit using a 3-way handshake, guarantees in-order delivery using sequence numbers, retransmits lost packets, and performs flow and congestion control.',
  },
  {
    q: '02. What is Client-Server Architecture?',
    a: 'Client-server architecture divides responsibilities between a central server process that listens on a known port and manages shared state, and multiple client processes (browsers) that connect to the server to send requests and receive updates.',
  },
  {
    q: '03. What is Socket Communication?',
    a: 'A socket is a software endpoint identified by an IP address and a port number. Through operating-system socket descriptors, processes read and write bidirectional byte streams across local or wide-area networks.',
  },
  {
    q: '04. How Does a Client Connect to the Server?',
    a: 'When a user opens the web application, the browser establishes a TCP connection to the server host and port, then sends an HTTP Upgrade request. Socket.IO negotiates a WebSocket upgrade over that TCP connection, assigning the client a unique Session ID (SID).',
  },
  {
    q: '05. How Are Messages Transmitted?',
    a: 'When a user submits a message, the client emits a JSON-encoded Socket.IO event over the open WebSocket frame. TCP splits the payload into packets, verifies checksums and acknowledgments, and delivers the intact message to the server handler.',
  },
  {
    q: '06. How Does the Server Manage Multiple Clients?',
    a: 'The server maintains an active session registry mapping each unique Socket ID to a validated username. Synchronization primitives protect shared state during concurrent joins, broadcasts, and departures.',
  },
  {
    q: '07. What Is Real-Time Communication?',
    a: 'Unlike traditional HTTP polling where clients repeatedly ask the server for updates, full-duplex WebSocket communication keeps the TCP channel open so the server can push new messages and presence updates with sub-second latency.',
  },
  {
    q: '08. How Are Disconnections Handled?',
    a: 'Graceful logouts emit a logout event, while abrupt tab closures trigger TCP FIN packets or Socket.IO ping/pong heartbeat timeouts. In both cases, the disconnect handler updates the active table and notifies remaining clients immediately.',
  },
];

export function NetworkVisualizerPage({
  directory,
  currentUser,
  connectionStatus,
  recentPackets,
  onPingNetwork,
}: NetworkVisualizerPageProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'lab'>('live');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('handshake');
  const [stepIndex, setStepIndex] = useState(0);

  const onlineUsers = useMemo(() => directory.filter((u) => u.isOnline), [directory]);
  const latestPacket = recentPackets[recentPackets.length - 1] || null;

  // Arrange live connected users radially around Central Server (360, 210)
  const nodePositions = useMemo(() => {
    const cx = 360;
    const cy = 210;
    const rx = 240;
    const ry = 140;
    return onlineUsers.map((user, idx) => {
      const total = Math.max(onlineUsers.length, 1);
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      return {
        user,
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      };
    });
  }, [onlineUsers]);

  const currentScenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const currentStep = currentScenario.steps[stepIndex] || currentScenario.steps[0];

  return (
    <div className="relative z-10 py-10 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-[1440px] space-y-8 px-6 lg:px-10">
        {/* Header + Mode Switch */}
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-violet-700 dark:text-cyan-300">
              Real-Time Topology & Transport Telemetry
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
              Network Visualizer & TCP Protocol Lab
            </h1>
            <p className="mt-2.5 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Observe live Socket.IO connections over TCP and real packet flow between connected
              clients and the central server, or step through fundamental networking concepts.
            </p>
          </div>

          <div className="inline-flex shrink-0 rounded-xl border border-slate-200/90 bg-white/80 p-1 backdrop-blur-md dark:border-violet-500/25 dark:bg-slate-900/70">
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'live'
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Live Topology ({onlineUsers.length} Online)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lab')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'lab'
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              <span>TCP Protocol Lab</span>
            </button>
          </div>
        </div>

        {activeTab === 'live' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Interactive Live Topology Canvas */}
            <section className="rounded-2xl border border-slate-200/90 bg-white/85 p-6 backdrop-blur-xl lg:col-span-8 dark:border-violet-500/25 dark:bg-[#0b0e23]/85">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-violet-500/15">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                    Live Central Server & Client Topology
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Connection: <span className="font-mono">{connectionStatus}</span> · Active
                    clients: <span className="font-mono tabular-nums">{onlineUsers.length}</span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={connectionStatus !== 'connected'}
                  onClick={onPingNetwork}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/20 transition-all hover:brightness-110 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Real Ping Packet</span>
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-950 p-3 dark:border-violet-500/25">
                <svg
                  viewBox="0 0 720 420"
                  role="img"
                  aria-label="Live network topology showing central server and active client nodes"
                  className="h-auto w-full"
                >
                  <defs>
                    <radialGradient id="serverGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(124,58,237,0.45)" />
                      <stop offset="100%" stopColor="rgba(124,58,237,0)" />
                    </radialGradient>
                  </defs>

                  <circle cx="360" cy="210" r="145" fill="url(#serverGlow)" />

                  {/* Connection edges to live clients */}
                  {nodePositions.map(({ user, x, y }) => {
                    const isSender = latestPacket?.fromUsername === user.username;
                    const isReceiver = latestPacket?.toUsernames.includes(user.username);
                    const active = isSender || isReceiver;

                    return (
                      <g key={`edge-${user.id}`}>
                        <line
                          x1={x}
                          y1={y}
                          x2={360}
                          y2={210}
                          stroke={
                            isSender
                              ? '#22D3EE'
                              : isReceiver
                                ? '#A78BFA'
                                : 'rgba(148,163,184,0.35)'
                          }
                          strokeWidth={active ? '3' : '1.5'}
                          strokeDasharray={active ? '6 4' : undefined}
                        />
                        {active && (
                          <circle r="5.5" fill={isSender ? '#22D3EE' : '#A78BFA'}>
                            <animateMotion
                              key={`${latestPacket?.id}-${user.id}`}
                              dur="0.85s"
                              repeatCount="1"
                              path={
                                isSender
                                  ? `M ${x} ${y} L 360 210`
                                  : `M 360 210 L ${x} ${y}`
                              }
                            />
                          </circle>
                        )}
                      </g>
                    );
                  })}

                  {/* Central Server Node */}
                  <g transform="translate(278, 162)">
                    <rect
                      width="164"
                      height="96"
                      rx="16"
                      fill="#131636"
                      stroke="#22D3EE"
                      strokeWidth="2"
                    />
                    <text
                      x="82"
                      y="36"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="14"
                      fontWeight="700"
                    >
                      Central TCP Server
                    </text>
                    <text
                      x="82"
                      y="58"
                      textAnchor="middle"
                      fill="#67E8F9"
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      Socket.IO · Port 3000
                    </text>
                    <text
                      x="82"
                      y="78"
                      textAnchor="middle"
                      fill="#C4B5FD"
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      {onlineUsers.length} Active {onlineUsers.length === 1 ? 'Socket' : 'Sockets'}
                    </text>
                  </g>

                  {/* Connected Client Nodes */}
                  {nodePositions.map(({ user, x, y }) => {
                    const isSelf = user.username === currentUser;
                    const mood = MOOD_CONFIGS[user.presence] || MOOD_CONFIGS.available;
                    return (
                      <g key={user.id} transform={`translate(${x - 68}, ${y - 30})`}>
                        <rect
                          width="136"
                          height="60"
                          rx="12"
                          fill="#0f172a"
                          stroke={isSelf ? '#22D3EE' : '#7C3AED'}
                          strokeWidth={isSelf ? '2.2' : '1.5'}
                        />
                        <circle cx="20" cy="24" r="5" fill="#10B981" />
                        <text x="32" y="28" fill="#F8FAFC" fontSize="12" fontWeight="700">
                          {user.displayName.slice(0, 12)}
                        </text>
                        <text
                          x="16"
                          y="46"
                          fill="#94A3B8"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          {isSelf ? 'You · ' : ''}
                          {mood.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Empty state overlay inside SVG if no user has joined yet */}
                  {onlineUsers.length === 0 && (
                    <text
                      x="360"
                      y="330"
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="13"
                    >
                      Join the Chat Room from one or more tabs to see live client nodes appear here.
                    </text>
                  )}
                </svg>
              </div>
            </section>

            {/* Real-Time Packet Stream Log */}
            <aside className="flex flex-col rounded-2xl border border-slate-200/90 bg-white/85 p-6 backdrop-blur-xl lg:col-span-4 dark:border-violet-500/25 dark:bg-[#0b0e23]/85">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-violet-500/15">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-cyan-500" />
                  <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
                    Live Packet Stream
                  </h2>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {recentPackets.length} events
                </span>
              </div>

              <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
                {recentPackets.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Awaiting Live Packets
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Click “Send Real Ping Packet” or send messages in chat to watch real Socket.IO
                      frames travel over TCP.
                    </p>
                  </div>
                ) : (
                  [...recentPackets].reverse().map((pkt) => (
                    <motion.div
                      key={pkt.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/90 p-3 text-xs dark:border-white/10 dark:bg-[#060714]/75"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-violet-700 dark:text-cyan-300">
                          {pkt.eventType.toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-slate-500">
                          {pkt.timestamp} · {pkt.bytes} B
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">{pkt.fromUsername}</span> →{' '}
                        <span className="text-slate-500 dark:text-slate-400">Server</span>
                        {pkt.toUsernames.length > 0 && (
                          <>
                            {' '}
                            →{' '}
                            <span className="font-semibold">
                              {pkt.toUsernames.slice(0, 3).join(', ')}
                              {pkt.toUsernames.length > 3 ? ` +${pkt.toUsernames.length - 3}` : ''}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {pkt.transport}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Interactive Step-by-Step TCP Protocol Lab */}
            <section className="rounded-2xl border border-slate-200/90 bg-white/85 p-6 backdrop-blur-xl lg:p-8 dark:border-violet-500/25 dark:bg-[#0b0e23]/85">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-center dark:border-violet-500/15">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                    Step-by-Step Client-Server Packet Simulator
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Select a protocol stage and step through how frames travel over TCP sockets.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStepIndex((p) => (p + 1) % currentScenario.steps.length)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>
                      Step {stepIndex + 1} of {currentScenario.steps.length} · Next
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStepIndex(0)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setScenarioId(s.id);
                      setStepIndex(0);
                    }}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                      scenarioId === s.id
                        ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-xl border border-slate-200/80 bg-slate-950 p-4 lg:col-span-8 dark:border-violet-500/20">
                  <svg viewBox="0 0 760 320" className="h-auto w-full">
                    <line
                      x1="175"
                      y1="70"
                      x2="380"
                      y2="160"
                      stroke={
                        currentStep.from === 'clientA' ||
                        currentStep.to === 'clientA' ||
                        currentStep.to === 'all'
                          ? '#22D3EE'
                          : '#475569'
                      }
                      strokeWidth="2.5"
                      strokeDasharray={currentStep.to === 'all' ? '6 4' : undefined}
                    />
                    <line
                      x1="175"
                      y1="250"
                      x2="380"
                      y2="160"
                      stroke={
                        currentStep.from === 'clientB' ||
                        currentStep.to === 'clientB' ||
                        currentStep.to === 'all'
                          ? '#22D3EE'
                          : '#475569'
                      }
                      strokeWidth="2.5"
                      strokeDasharray={currentStep.to === 'all' ? '6 4' : undefined}
                    />
                    <line
                      x1="585"
                      y1="160"
                      x2="380"
                      y2="160"
                      stroke={
                        currentStep.from === 'clientC' ||
                        currentStep.to === 'clientC' ||
                        currentStep.to === 'all'
                          ? '#A78BFA'
                          : '#475569'
                      }
                      strokeWidth="2.5"
                      strokeDasharray={currentStep.to === 'all' ? '6 4' : undefined}
                    />

                    <g transform="translate(25, 30)">
                      <rect width="150" height="78" rx="12" fill="#0f172a" stroke="#7C3AED" />
                      <text x="16" y="32" fill="#F8FAFC" fontSize="13" fontWeight="700">
                        Client A · Rahul
                      </text>
                      <text x="16" y="54" fill="#94A3B8" fontSize="11" fontFamily="monospace">
                        TCP Ephemeral Port
                      </text>
                    </g>

                    <g transform="translate(25, 210)">
                      <rect width="150" height="78" rx="12" fill="#0f172a" stroke="#3B82F6" />
                      <text x="16" y="32" fill="#F8FAFC" fontSize="13" fontWeight="700">
                        Client B · Aman
                      </text>
                      <text x="16" y="54" fill="#94A3B8" fontSize="11" fontFamily="monospace">
                        {scenarioId === 'disconnect' ? 'FIN / Disconnected' : 'TCP Ephemeral Port'}
                      </text>
                    </g>

                    <g transform="translate(295, 105)">
                      <rect width="170" height="110" rx="14" fill="#5B21B6" stroke="#22D3EE" />
                      <text x="20" y="36" fill="#FFFFFF" fontSize="14" fontWeight="700">
                        Central Server
                      </text>
                      <text x="20" y="58" fill="#BAE6FD" fontSize="11" fontFamily="monospace">
                        Socket.IO / TCP
                      </text>
                      <text x="20" y="78" fill="#BAE6FD" fontSize="11" fontFamily="monospace">
                        Port 3000 / 5000
                      </text>
                      <text x="20" y="96" fill="#BAE6FD" fontSize="11" fontFamily="monospace">
                        User Map + Router
                      </text>
                    </g>

                    <g transform="translate(585, 121)">
                      <rect width="150" height="78" rx="12" fill="#0f172a" stroke="#06B6D4" />
                      <text x="16" y="32" fill="#F8FAFC" fontSize="13" fontWeight="700">
                        Client C · Priya
                      </text>
                      <text x="16" y="54" fill="#94A3B8" fontSize="11" fontFamily="monospace">
                        {scenarioId === 'private' ? 'Private Recipient' : 'TCP Ephemeral Port'}
                      </text>
                    </g>

                    <g transform="translate(205, 20)">
                      <rect width="350" height="36" rx="9" fill="#1e293b" stroke="#334155" />
                      <text
                        x="175"
                        y="22"
                        textAnchor="middle"
                        fill="#67E8F9"
                        fontSize="11"
                        fontFamily="monospace"
                      >
                        {currentStep.packet}
                      </text>
                    </g>
                  </svg>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/90 p-5 lg:col-span-4 dark:border-white/10 dark:bg-[#060714]/80">
                  <div>
                    <p className="font-mono text-xs font-semibold text-violet-600 dark:text-cyan-300">
                      Step {stepIndex + 1} / {currentScenario.steps.length}
                    </p>
                    <h3 className="mt-2 font-display text-lg font-bold text-slate-950 dark:text-white">
                      {currentStep.label}
                    </h3>
                    <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {currentStep.packet}
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {currentStep.explanation}
                    </p>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
                    {currentScenario.steps.map((s, idx) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setStepIndex(idx)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                          idx === stepIndex
                            ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-cyan-200'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
                        }`}
                      >
                        <span>
                          {idx + 1}. {s.label}
                        </span>
                        {idx === stepIndex && <ArrowRight className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 8 Core Networking Concepts */}
            <section>
              <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Core Computer Networks Concepts Explained
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                {NETWORK_TOPICS.map((topic) => (
                  <article
                    key={topic.q}
                    className="rounded-2xl border border-slate-200/90 bg-white/85 p-6 backdrop-blur-xl dark:border-violet-500/20 dark:bg-[#0b0e23]/85"
                  >
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
                      {topic.q}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {topic.a}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {/* Socket.IO vs Raw TCP Table */}
            <section className="rounded-2xl border border-slate-200/90 bg-white/85 p-6 backdrop-blur-xl lg:p-8 dark:border-violet-500/25 dark:bg-[#0b0e23]/85">
              <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Socket.IO / WebSocket over TCP vs. Raw Python TCP Socket Server
              </h2>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="py-3 pr-4">Aspect</th>
                      <th className="py-3 pr-4">Socket.IO / WebSocket (This Web App)</th>
                      <th className="py-3">Raw Python TCP Socket Server</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold">Underlying Transport</td>
                      <td className="py-3.5 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span>TCP (via HTTP Upgrade to RFC 6455 WebSocket)</span>
                        </span>
                      </td>
                      <td className="py-3.5">Raw TCP via OS <code className="font-mono">SOCK_STREAM</code></td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold">Browser Compatibility</td>
                      <td className="py-3.5 pr-4">Runs natively inside modern web browsers</td>
                      <td className="py-3.5">Cannot be opened directly from browser JS sandbox</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold">Message Framing</td>
                      <td className="py-3.5 pr-4">Built-in frame boundaries + named events</td>
                      <td className="py-3.5">Manual length-prefix or delimiter parsing needed</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold">Concurrency & Heartbeat</td>
                      <td className="py-3.5 pr-4">Automatic ping/pong disconnect detection & rooms</td>
                      <td className="py-3.5">Manual <code className="font-mono">threading</code> or <code className="font-mono">select()</code> loop</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
