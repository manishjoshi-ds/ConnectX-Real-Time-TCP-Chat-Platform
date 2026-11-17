import { useEffect, useState } from 'react';
import { Check, Copy, FileCode2, Terminal } from 'lucide-react';
import type { FlaskProjectFile } from '../types/chat';

interface DocSection {
  id: string;
  title: string;
  body: string[];
  bullets?: string[];
}

const ACADEMIC_SECTIONS: DocSection[] = [
  {
    id: 'abstract',
    title: '01. Abstract',
    body: [
      'This project presents the design and implementation of a Multi-Client Chat Application Using TCP, built to demonstrate real-time client-server communication and Computer Networks fundamentals in an accessible web interface.',
      'By combining WebSocket transport over TCP with a server-authoritative Socket.IO event engine, multiple clients can connect concurrently, broadcast messages to a common chat room, exchange confidential 1-to-1 private messages, and receive instant presence updates upon join or unexpected disconnection.',
    ],
  },
  {
    id: 'introduction',
    title: '02. Introduction',
    body: [
      'Modern networked applications rely heavily on low-latency, full-duplex communication between distributed clients and centralized or clustered servers. Traditional HTTP request-response cycles require the client to initiate every exchange, making them inefficient for live messaging.',
      'This application demonstrates how persistent TCP-backed WebSocket connections overcome polling overhead while preserving TCP’s guarantees of reliable, ordered, error-checked byte delivery.',
    ],
  },
  {
    id: 'problem',
    title: '03. Problem Statement',
    body: [
      'Desktop CLI socket chat programs are difficult to demonstrate visually during academic reviews and lack modern session management, browser accessibility, and XSS protection.',
      'Conversely, naive web demos often rely on static mocks or insecure client-side state. There is a need for a real-time web-based multi-client chat system that uses genuine socket communication, enforces server-side username uniqueness, supports selective private routing, and documents the underlying TCP concepts clearly.',
    ],
  },
  {
    id: 'objectives',
    title: '04. Objectives',
    body: ['The primary engineering and academic objectives of this project are:'],
    bullets: [
      'Establish persistent, bidirectional WebSocket communication running over TCP.',
      'Support simultaneous multi-client sessions (e.g., Rahul, Aman, Priya) with live online presence tracking.',
      'Implement both common chat room broadcasting and targeted 1-to-1 private messaging.',
      'Enforce server-side validation for empty messages, malformed usernames, and duplicate active usernames.',
      'Handle graceful logouts and abrupt socket disconnections without leaving stale users in the room.',
      'Provide a clean, responsive light/dark interface with XSS-safe text rendering.',
    ],
  },
  {
    id: 'software',
    title: '05. Software Requirements',
    body: ['Software stack required for live web execution and local Python/Flask deployment:'],
    bullets: [
      'Python 3.10+ with Flask, Flask-SocketIO, and Simple-WebSocket (for local Python execution).',
      'Node.js 20+ with Express and Socket.IO (for integrated preview runtime on Port 3000).',
      'Frontend: HTML5, CSS3, JavaScript / TypeScript, Socket.IO Client v4.',
      'Modern Web Browser: Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari.',
    ],
  },
  {
    id: 'hardware',
    title: '06. Hardware Requirements',
    body: ['Minimal commodity hardware is sufficient to host and test multiple concurrent clients:'],
    bullets: [
      'Processor: Dual-Core x86_64 or ARM64 CPU (1.8 GHz or higher).',
      'Memory: Minimum 4 GB RAM (8 GB recommended when running multiple browser windows).',
      'Storage: 200 MB free disk space for runtime dependencies and source files.',
      'Network: Loopback interface (127.0.0.1) for local testing or LAN/Wi-Fi adapter for multi-device testing.',
    ],
  },
  {
    id: 'architecture',
    title: '07. System Architecture',
    body: [
      'The system adopts a centralized Client-Server Star Topology. Each client establishes a dedicated TCP-backed WebSocket channel to the central server.',
      'The server maintains an authoritative in-memory session table mapping each unique Socket ID (sid) to a validated username. Incoming events are validated on the server before updating state or emitting frames to target sockets.',
    ],
  },
  {
    id: 'methodology',
    title: '08. Working Methodology',
    body: ['Every chat session progresses through four deterministic protocol phases:'],
    bullets: [
      'Connection Phase: Client initiates TCP 3-way handshake and upgrades HTTP to WebSocket.',
      'Registration Phase: Client sends join_chat with username; server checks uniqueness under synchronization lock and returns join_success + recent room history.',
      'Messaging Phase: Public messages trigger server broadcast to all active SIDs; private messages resolve the recipient SID and emit strictly to recipient and sender.',
      'Termination Phase: Explicit logout or TCP disconnect triggers user removal and broadcasts updated presence lists.',
    ],
  },
  {
    id: 'networking',
    title: '09. Networking Concepts',
    body: [
      'TCP guarantees reliable, ordered delivery of message frames via sequence numbers, acknowledgments, and retransmission.',
      'Socket.IO operates at the application layer over WebSocket (RFC 6455) and TCP, providing automatic reconnection, heartbeat ping/pong keepalives, and event multiplexing without requiring raw browser TCP sockets.',
    ],
  },
  {
    id: 'advantages',
    title: '10. Advantages',
    body: ['Key strengths of this architecture include:'],
    bullets: [
      'Zero polling overhead due to persistent full-duplex WebSocket frames.',
      'Cross-platform browser access without requiring terminal client binaries.',
      'Strict server-side validation preventing duplicate identities and HTML injection.',
      'Clear separation between frontend UI, transport events, and backend state.',
    ],
  },
  {
    id: 'limitations',
    title: '11. Limitations',
    body: ['Current design boundaries intentional for a lightweight academic scope:'],
    bullets: [
      'Messages and active sessions reside in server memory rather than a persistent database.',
      'Single-server instance without Redis pub/sub horizontal scaling across multiple nodes.',
      'No password-based user accounts or end-to-end cryptographic key exchange.',
    ],
  },
  {
    id: 'applications',
    title: '12. Applications',
    body: ['Real-world domains utilizing identical multi-client socket patterns:'],
    bullets: [
      'Campus intranet messaging and collaborative classroom Q&A rooms.',
      'Customer support live-chat widgets and incident response war rooms.',
      'Multiplayer game lobbies and real-time telemetry dashboards.',
    ],
  },
  {
    id: 'future',
    title: '13. Future Scope',
    body: ['Natural extensions for advanced coursework or production hardening:'],
    bullets: [
      'Persist chat transcripts in PostgreSQL or SQLite with search indexing.',
      'Add end-to-end encryption (WebCrypto ECDH + AES-GCM) for private messages.',
      'Support multiple named rooms, typing indicators, and file/image chunk transfer.',
    ],
  },
  {
    id: 'conclusion',
    title: '14. Conclusion',
    body: [
      'The Multi-Client Chat Application Using TCP successfully bridges theoretical Computer Networks concepts with a live, testable full-stack implementation. By handling concurrent clients, private socket routing, validation, and disconnection recovery, it provides a clear and practical demonstration for B.Tech Computer Networks evaluation and viva.',
    ],
  },
  {
    id: 'references',
    title: '15. References',
    body: ['Authoritative technical standards and documentation referenced:'],
    bullets: [
      'RFC 9293 — Transmission Control Protocol (TCP) Specification, IETF.',
      'RFC 6455 — The WebSocket Protocol, IETF.',
      'Kurose, J. F., & Ross, K. W. — Computer Networking: A Top-Down Approach.',
      'Flask-SocketIO Official Documentation — Miguel Grinberg.',
      'Socket.IO Protocol v5 Specification.',
    ],
  },
];

export function AcademicDocsPage() {
  const [activeDocId, setActiveDocId] = useState<string>('abstract');
  const [flaskFiles, setFlaskFiles] = useState<FlaskProjectFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('app.py');
  const [copiedPath, setCopiedPath] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    fetch('/api/flask-project')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.files)) {
          setFlaskFiles(data.files);
          if (data.files.length > 0) {
            setSelectedFilePath(data.files[0].path);
          }
        }
      })
      .catch(() => {
        // Ignore gracefully; local setup commands remain visible
      })
      .finally(() => {
        if (active) setLoadingFiles(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeSection =
    ACADEMIC_SECTIONS.find((s) => s.id === activeDocId) || ACADEMIC_SECTIONS[0];
  const selectedFile = flaskFiles.find((f) => f.path === selectedFilePath);

  const handleCopy = async (content: string, path: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(''), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="relative z-10 py-10 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-[1440px] space-y-10 px-6 lg:px-10">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-300/60 bg-violet-100/70 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-cyan-300">
            Academic Project Report · B.Tech Computer Networks
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Project Documentation & Local Setup Guide
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Complete structured documentation suitable for project submission and viva examination,
            alongside the runnable Python + Flask-SocketIO source code.
          </p>
        </div>

        {/* Academic Sections Browser */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-xl shadow-violet-500/5 backdrop-blur-xl lg:col-span-4 dark:border-white/10 dark:bg-[#0d0f26]/80 dark:shadow-black/30">
            <h2 className="px-2 pb-3 font-display text-sm font-bold text-slate-900 dark:text-white">
              Report Index
            </h2>
            <nav aria-label="Documentation Sections" className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {ACADEMIC_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveDocId(sec.id)}
                  className={`rounded-xl px-3 py-2 text-left text-sm transition-all ${
                    activeDocId === sec.id
                      ? 'bg-gradient-to-r from-violet-600/15 to-cyan-500/15 font-semibold text-violet-700 ring-1 ring-violet-500/30 dark:from-violet-500/25 dark:to-cyan-500/20 dark:text-cyan-200'
                      : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/5'
                  }`}
                >
                  {sec.title}
                </button>
              ))}
            </nav>
          </aside>

          <article className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-violet-500/5 backdrop-blur-xl lg:col-span-8 lg:p-8 dark:border-white/10 dark:bg-[#0d0f26]/80 dark:shadow-black/30">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {activeSection.title}
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700 dark:text-slate-300">
              {activeSection.body.map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
            {activeSection.bullets && (
              <ul className="mt-5 space-y-2.5 border-t border-slate-200/80 pt-5 text-sm leading-relaxed text-slate-700 dark:border-white/10 dark:text-slate-300">
                {activeSection.bullets.map((bullet, i) => (
                  <li key={bullet} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-semibold text-violet-600 dark:text-cyan-400">
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        {/* How to Run Locally (Python Flask-SocketIO) */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-violet-500/5 backdrop-blur-xl lg:p-8 dark:border-white/10 dark:bg-[#0d0f26]/80 dark:shadow-black/30">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-violet-600 dark:text-cyan-400" />
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              How to Run Locally (Python + Flask-SocketIO)
            </h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            The complete Python project is organized under{' '}
            <code className="font-mono text-slate-900 dark:text-white">
              Multi_Client_Chat_Website/
            </code>
            . Follow these commands to run the Flask-SocketIO server on your local machine:
          </p>

          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-[#060714] p-4 font-mono text-xs leading-relaxed text-cyan-100 dark:border-white/10">
{`cd Multi_Client_Chat_Website
python3 -m venv venv
source venv/bin/activate        # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python app.py                   # Starts Flask-SocketIO on http://localhost:5000`}
          </pre>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Test 1 · Multi-Client Join
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Open 3 browser tabs as Rahul, Aman, and Priya and verify live user list updates.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Test 2 · Private Routing
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Click Priya in Rahul&apos;s sidebar, send a private message, and verify Aman does not
                receive it.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Test 3 · Duplicate & Disconnect
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Attempt a duplicate Rahul login for error validation, then close Aman&apos;s tab to
                confirm disconnect cleanup.
              </p>
            </div>
          </div>
        </section>

        {/* Live Python Source Explorer */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-violet-500/5 backdrop-blur-xl lg:p-8 dark:border-white/10 dark:bg-[#0d0f26]/80 dark:shadow-black/30">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <FileCode2 className="h-5 w-5 text-violet-600 dark:text-cyan-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Multi_Client_Chat_Website Source Explorer
              </h2>
            </div>

            {selectedFile && (
              <button
                type="button"
                onClick={() => handleCopy(selectedFile.content, selectedFile.path)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
              >
                {copiedPath === selectedFile.path ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy {selectedFile.path}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {loadingFiles ? (
            <p className="py-8 text-sm text-slate-500 dark:text-slate-400">
              Loading Python project source files...
            </p>
          ) : flaskFiles.length === 0 ? (
            <p className="py-8 text-sm text-slate-500 dark:text-slate-400">
              Source files are located in the Multi_Client_Chat_Website/ directory.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-1 lg:col-span-3">
                {flaskFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`w-full rounded-xl px-3 py-2 text-left font-mono text-xs transition-all ${
                      selectedFilePath === file.path
                        ? 'bg-gradient-to-r from-violet-600/15 to-cyan-500/15 font-semibold text-violet-700 ring-1 ring-violet-500/30 dark:from-violet-500/25 dark:to-cyan-500/20 dark:text-cyan-200'
                        : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>

              <div className="lg:col-span-9">
                <pre className="max-h-[460px] overflow-auto rounded-xl border border-slate-200/80 bg-[#060714] p-4 font-mono text-xs leading-relaxed text-slate-100 dark:border-white/10">
                  {selectedFile?.content}
                </pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
