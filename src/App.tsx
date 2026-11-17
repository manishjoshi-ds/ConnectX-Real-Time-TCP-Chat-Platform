import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { io, type Socket } from 'socket.io-client';
import { AcademicDocsPage } from './components/AcademicDocsPage';
import { ChatDashboard } from './components/ChatDashboard';
import { InteractiveBackground } from './components/InteractiveBackground';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { NetworkVisualizerPage } from './components/NetworkVisualizerPage';
import { ToastContainer } from './components/ToastContainer';
import type {
  AppNotification,
  AppPage,
  ChatMessage,
  ChatThemeId,
  ConnectionStatus,
  ConversationSummary,
  NetworkPacketEvent,
  UserPresence,
  UserProfile,
} from './types/chat';
import { playSoundEffect, triggerConfettiBurst } from './utils/effects';
import { resolveChatTheme } from './utils/format';

export default function App() {
  const [page, setPage] = useState<AppPage>('landing');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('tcpchat_theme');
    return stored ? stored === 'dark' : true;
  });
  const [chatTheme, setChatTheme] = useState<ChatThemeId>(() => {
    if (typeof window === 'undefined') return 'midnight-purple';
    const saved = localStorage.getItem('tcpchat_chat_theme');
    return resolveChatTheme(saved).id;
  });
  const [conversationThemes, setConversationThemes] = useState<Record<string, ChatThemeId>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('tcpchat_conv_themes');
      return raw ? (JSON.parse(raw) as Record<string, ChatThemeId>) : {};
    } catch {
      return {};
    }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('tcpchat_sound') !== 'off';
  });
  const [effectsEnabled, setEffectsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('tcpchat_effects') !== 'off';
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [socketId, setSocketId] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');
  const [serverOnlineCount, setServerOnlineCount] = useState<number>(0);

  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('public');
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>({});
  const [typingByConv, setTypingByConv] = useState<Record<string, string[]>>({});
  const [recentPackets, setRecentPackets] = useState<NetworkPacketEvent[]>([]);

  const [joinError, setJoinError] = useState<string>('');
  const [chatError, setChatError] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const currentUserRef = useRef<string>('');
  const activeConversationRef = useRef<string>('public');
  const authTokenRef = useRef<string>('');
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const effectsEnabledRef = useRef<boolean>(effectsEnabled);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem('tcpchat_sound', soundEnabled ? 'on' : 'off');
  }, [soundEnabled]);

  useEffect(() => {
    effectsEnabledRef.current = effectsEnabled;
    localStorage.setItem('tcpchat_effects', effectsEnabled ? 'on' : 'off');
  }, [effectsEnabled]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('tcpchat_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleChangeChatTheme = (nextTheme: ChatThemeId) => {
    setChatTheme(nextTheme);
    localStorage.setItem('tcpchat_chat_theme', nextTheme);
  };

  const handleChangeConversationTheme = (conversationId: string, themeId: ChatThemeId | null) => {
    setConversationThemes((prev) => {
      const next = { ...prev };
      if (themeId) {
        next[conversationId] = themeId;
      } else {
        delete next[conversationId];
      }
      localStorage.setItem('tcpchat_conv_themes', JSON.stringify(next));
      return next;
    });
  };

  const pushNotification = useCallback(
    (
      kind: AppNotification['kind'],
      title: string,
      body: string,
      conversationId = '',
    ) => {
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      setNotifications((prev) => [
        ...prev.slice(-3),
        { id, kind, title, body, conversationId, createdAt: new Date().toISOString() },
      ]);
      window.setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 4500);
    },
    [],
  );

  const loadConversationMessages = useCallback(async (conversationId: string, token: string) => {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        { headers: { 'x-auth-token': token } },
      );
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.messages)) {
        setMessagesByConv((prev) => ({
          ...prev,
          [conversationId]: json.messages,
        }));
      }
    } catch {
      // Ignore transient fetch failures
    }
  }, []);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      );
      if (!messagesByConv[conversationId] && authTokenRef.current) {
        loadConversationMessages(conversationId, authTokenRef.current);
      }
      socketRef.current?.emit('mark_read', { conversationId });
    },
    [loadConversationMessages, messagesByConv],
  );

  // Initialize persistent Socket.IO connection
  useEffect(() => {
    const socket = io({
      transports: ['polling', 'websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setSocketId(socket.id || '');
      if (currentUserRef.current) {
        socket.emit('join_chat', { username: currentUserRef.current });
      }
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setIsJoining(false);
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
      setIsJoining(false);
    });

    socket.on(
      'server_info',
      (data: {
        onlineCount?: number;
        sid?: string;
        directory?: UserProfile[];
        recentPackets?: NetworkPacketEvent[];
      }) => {
        if (typeof data?.onlineCount === 'number') {
          setServerOnlineCount(data.onlineCount);
        }
        if (data?.sid) setSocketId(data.sid);
        if (Array.isArray(data?.directory)) setDirectory(data.directory);
        if (Array.isArray(data?.recentPackets)) setRecentPackets(data.recentPackets);
      },
    );

    socket.on('network_packet', (pkt: NetworkPacketEvent) => {
      if (!pkt?.id) return;
      setRecentPackets((prev) => [...prev.slice(-29), pkt]);
    });

    socket.on('join_error', (data: { message?: string }) => {
      setIsJoining(false);
      setJoinError(data?.message || 'Unable to join the chat room.');
      if (currentUserRef.current) {
        setCurrentUser('');
        setCurrentProfile(null);
        setAuthToken('');
        setPage('login');
      }
    });

    socket.on(
      'join_success',
      (data: {
        username: string;
        sid: string;
        authToken: string;
        profile: UserProfile;
        directory: UserProfile[];
        conversations: ConversationSummary[];
        activeConversationId: string;
        history: ChatMessage[];
        recentPackets?: NetworkPacketEvent[];
      }) => {
        setIsJoining(false);
        setJoinError('');
        setCurrentUser(data.username);
        setCurrentProfile(data.profile);
        setSocketId(data.sid);
        setAuthToken(data.authToken);
        setDirectory(data.directory || []);
        setServerOnlineCount((data.directory || []).filter((u) => u.isOnline).length);
        setConversations(data.conversations || []);
        if (Array.isArray(data.recentPackets)) {
          setRecentPackets(data.recentPackets);
        }
        const startConv = data.activeConversationId || 'public';
        setActiveConversationId(startConv);
        setMessagesByConv((prev) => ({
          ...prev,
          [startConv]: data.history || [],
        }));
        setPage('chat');

        playSoundEffect('join', soundEnabledRef.current);
        triggerConfettiBurst(effectsEnabledRef.current);
      },
    );

    socket.on('users_update', (data: { users?: UserProfile[]; directory?: UserProfile[] }) => {
      const dir = data.directory || data.users || [];
      setDirectory(dir);
      const online = dir.filter((u) => u.isOnline);
      setServerOnlineCount(online.length);

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.type !== 'private' || !conv.peerUsername) return conv;
          const peer = dir.find((u) => u.username === conv.peerUsername);
          if (!peer) return conv;
          return {
            ...conv,
            name: peer.displayName || peer.username,
            avatarUrl: peer.avatarUrl,
            peerPresence: peer.presence,
            peerIsOnline: peer.isOnline,
            peerLastActive: peer.lastActive,
          };
        }),
      );
    });

    socket.on('profile_updated', (data: { profile: UserProfile }) => {
      if (data?.profile) {
        setCurrentProfile(data.profile);
      }
    });

    socket.on('conversation_updated', (data: { conversation: ConversationSummary }) => {
      const incoming = data?.conversation;
      if (!incoming) return;
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === incoming.id);
        if (exists) {
          return prev.map((c) =>
            c.id === incoming.id ? { ...incoming, unreadCount: c.unreadCount } : c,
          );
        }
        return [incoming, ...prev];
      });
    });

    socket.on(
      'dm_opened',
      (data: { conversation: ConversationSummary; messages: ChatMessage[] }) => {
        if (!data?.conversation) return;
        const conv = { ...data.conversation, unreadCount: 0 };
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === conv.id);
          return exists ? prev.map((c) => (c.id === conv.id ? conv : c)) : [conv, ...prev];
        });
        setMessagesByConv((prev) => ({
          ...prev,
          [conv.id]: data.messages || [],
        }));
        setActiveConversationId(conv.id);
        socket.emit('mark_read', { conversationId: conv.id });
      },
    );

    socket.on('group_created', (data: { conversation: ConversationSummary }) => {
      if (!data?.conversation) return;
      setActiveConversationId(data.conversation.id);
      triggerConfettiBurst(effectsEnabledRef.current);
      playSoundEffect('notify', soundEnabledRef.current);
      pushNotification(
        'group',
        'Group Created',
        `You created "${data.conversation.name}".`,
        data.conversation.id,
      );
    });

    socket.on('removed_from_group', (data: { conversationId: string }) => {
      const removedId = data?.conversationId;
      if (!removedId) return;
      setConversations((prev) => prev.filter((c) => c.id !== removedId));
      if (activeConversationRef.current === removedId) {
        setActiveConversationId('public');
      }
      pushNotification('group', 'Group Update', 'You are no longer a member of that group.');
    });

    socket.on('new_message', (data: { message: ChatMessage }) => {
      const msg = data?.message;
      if (!msg) return;

      setMessagesByConv((prev) => {
        const list = prev[msg.conversationId] || [];
        if (list.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [msg.conversationId]: [...list, msg] };
      });

      const isActive = activeConversationRef.current === msg.conversationId;
      const isFromMe = msg.sender === currentUserRef.current;

      if (msg.type !== 'system') {
        if (isFromMe) {
          playSoundEffect('send', soundEnabledRef.current);
        } else {
          playSoundEffect(isActive ? 'receive' : 'notify', soundEnabledRef.current);
          if (msg.text && msg.text.includes('🎉') && isActive) {
            triggerConfettiBurst(effectsEnabledRef.current);
          }
        }
      }

      if (isActive && !isFromMe && msg.type !== 'system') {
        socket.emit('mark_read', { conversationId: msg.conversationId });
      }

      if (!isActive && !isFromMe && msg.type !== 'system') {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c,
          ),
        );
        pushNotification(
          msg.media ? 'media' : 'message',
          msg.media
            ? `${msg.senderDisplayName || msg.sender} sent ${msg.media.mediaType}`
            : `New message from ${msg.senderDisplayName || msg.sender}`,
          msg.text || msg.media?.originalFilename || 'Attachment received',
          msg.conversationId,
        );
      }
    });

    socket.on('message_updated', (data: { message: ChatMessage }) => {
      const updated = data?.message;
      if (!updated) return;
      setMessagesByConv((prev) => {
        const list = prev[updated.conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [updated.conversationId]: list.map((m) => (m.id === updated.id ? updated : m)),
        };
      });
    });

    socket.on(
      'messages_read',
      (data: { conversationId: string; messageIds: string[]; reader: string }) => {
        if (!data?.conversationId || !Array.isArray(data.messageIds)) return;
        const idSet = new Set(data.messageIds);
        setMessagesByConv((prev) => {
          const list = prev[data.conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [data.conversationId]: list.map((m) =>
              idSet.has(m.id)
                ? {
                    ...m,
                    deliveryStatus: 'read',
                    readBy: m.readBy.includes(data.reader) ? m.readBy : [...m.readBy, data.reader],
                  }
                : m,
            ),
          };
        });
      },
    );

    socket.on(
      'typing_update',
      (data: { conversationId: string; username: string; isTyping: boolean }) => {
        if (!data?.conversationId || !data?.username) return;
        setTypingByConv((prev) => {
          const existing = prev[data.conversationId] || [];
          const next = data.isTyping
            ? existing.includes(data.username)
              ? existing
              : [...existing, data.username]
            : existing.filter((u) => u !== data.username);
          return { ...prev, [data.conversationId]: next };
        });
      },
    );

    socket.on('chat_error', (data: { message?: string }) => {
      const errMsg = data?.message || 'Unable to complete action.';
      setChatError(errMsg);
      pushNotification('error', 'Action Failed', errMsg);
    });

    socket.on('logged_out', () => {
      setCurrentUser('');
      setCurrentProfile(null);
      setAuthToken('');
      setConversations([]);
      setMessagesByConv({});
      setTypingByConv({});
      setActiveConversationId('public');
      setPage('login');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pushNotification]);

  const handleJoin = (username: string, mood: UserPresence) => {
    if (!socketRef.current) return;
    setIsJoining(true);
    setJoinError('');
    socketRef.current.emit('join_chat', { username, mood });
  };

  const handleToggleReaction = useCallback((messageId: string, emoji: string) => {
    if (!socketRef.current || !messageId || !emoji) return;
    socketRef.current.emit('toggle_reaction', { messageId, emoji });
    playSoundEffect('send', soundEnabledRef.current);
    if (emoji === '🎉') {
      triggerConfettiBurst(effectsEnabledRef.current);
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-[#f5f4ff] text-slate-900 transition-colors duration-200 dark:bg-[#060714] dark:text-slate-100">
      <InteractiveBackground enabled={effectsEnabled} subtle={page === 'chat'} />

      <Navbar
        currentPage={page}
        onNavigate={setPage}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        isLoggedIn={Boolean(currentUser)}
      />

      <AnimatePresence mode="wait">
        <motion.main
          key={page}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {page === 'landing' && (
            <LandingPage
              onNavigate={setPage}
              onlineCount={serverOnlineCount}
              isLoggedIn={Boolean(currentUser)}
            />
          )}

          {page === 'login' && (
            <LoginPage
              onJoin={handleJoin}
              error={joinError}
              isJoining={isJoining}
              connectionStatus={connectionStatus}
              onlineCount={serverOnlineCount}
              onClearError={() => setJoinError('')}
            />
          )}

          {page === 'chat' && currentUser && (
            <ChatDashboard
              currentUser={currentUser}
              currentProfile={currentProfile}
              socketId={socketId}
              authToken={authToken}
              directory={directory}
              conversations={conversations}
              activeConversationId={activeConversationId}
              messages={messagesByConv[activeConversationId] || []}
              typingUsers={typingByConv[activeConversationId] || []}
              connectionStatus={connectionStatus}
              chatError={chatError}
              chatTheme={chatTheme}
              conversationThemes={conversationThemes}
              soundEnabled={soundEnabled}
              effectsEnabled={effectsEnabled}
              recentPackets={recentPackets}
              onToggleSound={() => setSoundEnabled((p) => !p)}
              onToggleEffects={() => setEffectsEnabled((p) => !p)}
              onOpenNetworkVisualizer={() => setPage('networks')}
              onChangeChatTheme={handleChangeChatTheme}
              onChangeConversationTheme={handleChangeConversationTheme}
              onSelectConversation={handleSelectConversation}
              onOpenDm={(targetUsername) =>
                socketRef.current?.emit('open_dm', { targetUsername })
              }
              onSendMessage={(payload) => socketRef.current?.emit('send_message', payload)}
              onTypingChange={(conversationId, isTyping) =>
                socketRef.current?.emit('typing_state', { conversationId, isTyping })
              }
              onEditMessage={(messageId, text) =>
                socketRef.current?.emit('edit_message', { messageId, text })
              }
              onDeleteMessage={(messageId) =>
                socketRef.current?.emit('delete_message', { messageId })
              }
              onTogglePin={(messageId) =>
                socketRef.current?.emit('toggle_pin', { messageId })
              }
              onToggleReaction={handleToggleReaction}
              onUpdateProfile={(data) => socketRef.current?.emit('update_profile', data)}
              onCreateGroup={(name, description, memberUsernames) =>
                socketRef.current?.emit('create_group', {
                  name,
                  description,
                  memberUsernames,
                })
              }
              onAddGroupMember={(conversationId, username) =>
                socketRef.current?.emit('add_group_member', { conversationId, username })
              }
              onRemoveGroupMember={(conversationId, userId) =>
                socketRef.current?.emit('remove_group_member', { conversationId, userId })
              }
              onLogout={() => socketRef.current?.emit('logout')}
              onClearChatError={() => setChatError('')}
              onNotify={(kind, title, body) => pushNotification(kind, title, body)}
            />
          )}

          {page === 'chat' && !currentUser && (
            <LoginPage
              onJoin={handleJoin}
              error={joinError}
              isJoining={isJoining}
              connectionStatus={connectionStatus}
              onlineCount={serverOnlineCount}
              onClearError={() => setJoinError('')}
            />
          )}

          {page === 'networks' && (
            <NetworkVisualizerPage
              directory={directory}
              currentUser={currentUser}
              connectionStatus={connectionStatus}
              recentPackets={recentPackets}
              onPingNetwork={() => socketRef.current?.emit('ping_network')}
            />
          )}

          {page === 'docs' && <AcademicDocsPage />}
        </motion.main>
      </AnimatePresence>

      <ToastContainer
        notifications={notifications}
        onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
        onSelectConversation={(convId) => {
          if (currentUser) {
            setPage('chat');
            handleSelectConversation(convId);
          }
        }}
      />
    </div>
  );
}
