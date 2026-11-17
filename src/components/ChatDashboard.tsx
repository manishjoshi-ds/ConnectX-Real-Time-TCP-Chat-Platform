import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  Check,
  CheckCheck,
  Copy,
  Edit3,
  FileText,
  Film,
  FolderOpen,
  Hash,
  Image as ImageIcon,
  Info,
  Lock,
  LogOut,
  Menu,
  Mic,
  Music,
  Palette,
  Paperclip,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  Smile,
  SmilePlus,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  ChatThemeId,
  ConnectionStatus,
  ConversationSummary,
  MediaAttachment,
  NetworkPacketEvent,
  UserPresence,
  UserProfile,
} from '../types/chat';
import { triggerConfettiBurst } from '../utils/effects';
import {
  MOOD_CONFIGS,
  QUICK_EMOJIS,
  formatBytes,
  formatDuration,
  formatLastActive,
  resolveChatTheme,
} from '../utils/format';
import { Avatar } from './Avatar';
import {
  CreateGroupModal,
  GroupInfoModal,
  ImageLightboxModal,
  MediaAndFilesModal,
  ProfileSettingsModal,
  ThemeCustomizerModal,
  UserCardModal,
} from './ChatModals';
import { MediaMessage } from './MediaMessage';
import { ReactionPicker } from './ReactionPicker';

interface ChatDashboardProps {
  currentUser: string;
  currentProfile: UserProfile | null;
  socketId: string;
  authToken: string;
  directory: UserProfile[];
  conversations: ConversationSummary[];
  activeConversationId: string;
  messages: ChatMessage[];
  typingUsers: string[];
  connectionStatus: ConnectionStatus;
  chatError: string;
  chatTheme: ChatThemeId;
  conversationThemes: Record<string, ChatThemeId>;
  soundEnabled: boolean;
  effectsEnabled: boolean;
  recentPackets: NetworkPacketEvent[];
  onToggleSound: () => void;
  onToggleEffects: () => void;
  onOpenNetworkVisualizer: () => void;
  onChangeChatTheme: (theme: ChatThemeId) => void;
  onChangeConversationTheme: (conversationId: string, theme: ChatThemeId | null) => void;
  onSelectConversation: (conversationId: string) => void;
  onOpenDm: (targetUsername: string) => void;
  onSendMessage: (payload: {
    conversationId: string;
    text: string;
    mediaId?: string;
    replyToId?: string;
  }) => void;
  onTypingChange: (conversationId: string, isTyping: boolean) => void;
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onTogglePin: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onUpdateProfile: (data: {
    displayName: string;
    bio: string;
    statusText: string;
    presence: UserPresence;
    avatarColor: string;
  }) => void;
  onCreateGroup: (name: string, description: string, memberUsernames: string[]) => void;
  onAddGroupMember: (conversationId: string, username: string) => void;
  onRemoveGroupMember: (conversationId: string, userId: string) => void;
  onLogout: () => void;
  onClearChatError: () => void;
  onNotify: (
    kind: 'message' | 'media' | 'group' | 'system' | 'error',
    title: string,
    body: string,
  ) => void;
}

interface PendingAttachment {
  file: File;
  category: 'image' | 'video' | 'document' | 'audio';
  previewUrl: string | null;
  durationSec: number | null;
}

const ACCEPT_BY_CATEGORY: Record<PendingAttachment['category'], string> = {
  image: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  video: '.mp4,.webm,video/mp4,video/webm',
  document:
    '.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
  audio: '.mp3,.wav,.ogg,.m4a,.webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm',
};

const EXT_TO_CATEGORY: Record<string, PendingAttachment['category']> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  mp4: 'video',
  webm: 'video',
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  txt: 'document',
  ppt: 'document',
  pptx: 'document',
  xls: 'document',
  xlsx: 'document',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
};

export function ChatDashboard({
  currentUser,
  currentProfile,
  socketId,
  authToken,
  directory,
  conversations,
  activeConversationId,
  messages,
  typingUsers,
  connectionStatus,
  chatError,
  chatTheme,
  conversationThemes,
  soundEnabled,
  effectsEnabled,
  recentPackets,
  onToggleSound,
  onToggleEffects,
  onOpenNetworkVisualizer,
  onChangeChatTheme,
  onChangeConversationTheme,
  onSelectConversation,
  onOpenDm,
  onSendMessage,
  onTypingChange,
  onEditMessage,
  onDeleteMessage,
  onTogglePin,
  onToggleReaction,
  onUpdateProfile,
  onCreateGroup,
  onAddGroupMember,
  onRemoveGroupMember,
  onLogout,
  onClearChatError,
  onNotify,
}: ChatDashboardProps) {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Composer popovers & states
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Voice Recording (MediaRecorder -> audio/webm)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recSecondsRef = useRef<number>(0);

  // File upload & drag/drop state
  const [pendingFile, setPendingFile] = useState<PendingAttachment | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCategoryRef = useRef<PendingAttachment['category']>('image');

  // Search messages in active conversation
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);

  // Modals
  const [lightboxMedia, setLightboxMedia] = useState<MediaAttachment | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [inspectUser, setInspectUser] = useState<UserProfile | null>(null);
  const [mediaModalState, setMediaModalState] = useState<{
    open: boolean;
    tab: 'gallery' | 'files';
  }>({ open: false, tab: 'gallery' });

  // Spotlight index
  const [pinnedIdx, setPinnedIdx] = useState(0);

  // Scroll management
  const streamRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const typingTimerRef = useRef<number | null>(null);

  const activeConversation = useMemo(
    () =>
      conversations.find((c) => c.id === activeConversationId) || {
        id: 'public',
        type: 'public' as const,
        name: 'Common Chat Room',
        description: 'Public TCP broadcast channel',
        avatarUrl: null,
        members: [],
        unreadCount: 0,
      },
    [conversations, activeConversationId],
  );

  const perConvThemeId = conversationThemes[activeConversationId] || null;
  const theme = resolveChatTheme(perConvThemeId || chatTheme);
  const activeError = localError || chatError;

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.pinned && !m.deleted),
    [messages],
  );
  const activePinned =
    pinnedMessages.length > 0 ? pinnedMessages[pinnedIdx % pinnedMessages.length] : null;

  const publicConv = conversations.find((c) => c.id === 'public');
  const groupConvs = conversations.filter((c) => c.type === 'group');
  const dmConvs = conversations.filter((c) => c.type === 'private');
  const otherUsers = directory.filter((u) => u.username !== currentUser);
  const onlineCount = directory.filter((u) => u.isOnline).length;

  const filterLower = sidebarSearch.trim().toLowerCase();
  const filteredGroups = groupConvs.filter((g) => g.name.toLowerCase().includes(filterLower));
  const filteredUsers = otherUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(filterLower) ||
      u.displayName.toLowerCase().includes(filterLower),
  );

  const latestPacket = recentPackets[recentPackets.length - 1] || null;

  // Auto-scroll when new messages arrive or conversation switches
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConversationId]);

  // Clear reply/edit/search on conversation switch
  useEffect(() => {
    setReplyingTo(null);
    setEditingMsg(null);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setReactionTargetId(null);
    setPinnedIdx(0);
  }, [activeConversationId]);

  // Live backend message keyword search
  useEffect(() => {
    if (!searchOpen || !searchQuery.trim() || !authToken) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      fetch(
        `/api/conversations/${encodeURIComponent(activeConversationId)}/search?q=${encodeURIComponent(
          searchQuery.trim(),
        )}`,
        { headers: { 'x-auth-token': authToken } },
      )
        .then((res) => res.json())
        .then((json) => {
          if (Array.isArray(json.results)) setSearchResults(json.results);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchOpen, searchQuery, activeConversationId, authToken]);

  // Clean up object URLs on unmount/change
  useEffect(() => {
    return () => {
      if (pendingFile?.previewUrl) {
        URL.revokeObjectURL(pendingFile.previewUrl);
      }
    };
  }, [pendingFile]);

  // Clean up active voice recording if unmounted
  useEffect(() => {
    return () => {
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const handleStreamScroll = () => {
    const el = streamRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpToLatest(distanceFromBottom > 240);
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (localError) setLocalError('');
    if (chatError) onClearChatError();

    if (!editingMsg) {
      onTypingChange(activeConversationId, val.trim().length > 0);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (val.trim().length > 0) {
        typingTimerRef.current = window.setTimeout(() => {
          onTypingChange(activeConversationId, false);
        }, 2000);
      }
    }
  };

  const startVoiceRecording = async () => {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onNotify(
        'error',
        'Voice Recording Unavailable',
        'Your browser does not support MediaRecorder audio capture.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recChunksRef.current = [];
      recSecondsRef.current = 0;
      setRecordingSec(0);
      setIsRecording(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) {
          window.clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        setIsRecording(false);

        if (recChunksRef.current.length === 0) return;
        const blob = new Blob(recChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;

        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
        setPendingFile({
          file,
          category: 'audio',
          previewUrl: null,
          durationSec: Math.max(1, recSecondsRef.current),
        });
      };

      recorderRef.current = recorder;
      recorder.start();
      recTimerRef.current = window.setInterval(() => {
        recSecondsRef.current += 1;
        setRecordingSec(recSecondsRef.current);
      }, 1000);
    } catch {
      setIsRecording(false);
      onNotify(
        'error',
        'Microphone Permission Denied',
        'Allow microphone access in your browser to record voice messages.',
      );
    }
  };

  const stopVoiceRecording = (cancel = false) => {
    if (cancel) {
      recChunksRef.current = [];
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else {
      setIsRecording(false);
    }
  };

  const prepareFileAttachment = (file: File, forcedCategory?: PendingAttachment['category']) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const detected = forcedCategory || EXT_TO_CATEGORY[ext];
    if (!detected) {
      onNotify(
        'error',
        'Unsupported File Type',
        `".${ext}" is not supported. Choose JPG, PNG, WEBP, MP4, WEBM, PDF, DOC/DOCX, TXT, PPT/PPTX, XLS/XLSX, MP3, or WAV.`,
      );
      return;
    }

    const maxMb = detected === 'video' ? 50 : detected === 'image' ? 10 : 20;
    if (file.size > maxMb * 1024 * 1024) {
      onNotify('error', 'File Too Large', `${file.name} exceeds the ${maxMb} MB limit.`);
      return;
    }

    if (pendingFile?.previewUrl) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }

    const previewUrl =
      detected === 'image' || detected === 'video' ? URL.createObjectURL(file) : null;

    const attachment: PendingAttachment = {
      file,
      category: detected,
      previewUrl,
      durationSec: null,
    };

    if (detected === 'video' || detected === 'audio') {
      const mediaEl = document.createElement(detected);
      const objUrl = URL.createObjectURL(file);
      mediaEl.preload = 'metadata';
      mediaEl.src = objUrl;
      mediaEl.onloadedmetadata = () => {
        const dur = Number.isFinite(mediaEl.duration) ? mediaEl.duration : null;
        URL.revokeObjectURL(objUrl);
        setPendingFile((prev) =>
          prev && prev.file === file ? { ...prev, durationSec: dur } : prev,
        );
      };
      mediaEl.onerror = () => URL.revokeObjectURL(objUrl);
    }

    setPendingFile(attachment);
    setShowAttachMenu(false);
    setLocalError('');
  };

  const openFilePicker = (category: PendingAttachment['category']) => {
    selectedCategoryRef.current = category;
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = ACCEPT_BY_CATEGORY[category];
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      prepareFileAttachment(file, selectedCategoryRef.current);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      prepareFileAttachment(file);
    }
  };

  const cancelPendingUpload = () => {
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    if (pendingFile?.previewUrl) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }
    setPendingFile(null);
  };

  const uploadPendingFile = (): Promise<MediaAttachment | null> => {
    if (!pendingFile) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeXhrRef.current = xhr;
      setIsUploading(true);
      setUploadProgress(0);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };

      xhr.onload = () => {
        activeXhrRef.current = null;
        setIsUploading(false);
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && parsed.media) {
            resolve(parsed.media as MediaAttachment);
          } else {
            reject(new Error(parsed.error || 'Upload failed on server.'));
          }
        } catch {
          reject(new Error('Invalid server response during upload.'));
        }
      };

      xhr.onerror = () => {
        activeXhrRef.current = null;
        setIsUploading(false);
        reject(new Error('Network error during file upload.'));
      };

      xhr.onabort = () => {
        activeXhrRef.current = null;
        setIsUploading(false);
        reject(new Error('Upload cancelled.'));
      };

      const form = new FormData();
      form.append('file', pendingFile.file);
      form.append('conversationId', activeConversationId);
      form.append('category', pendingFile.category);
      if (pendingFile.durationSec) {
        form.append('durationSec', String(pendingFile.durationSec));
      }

      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('x-auth-token', authToken);
      xhr.send(form);
    });
  };

  const submitComposer = async () => {
    if (isUploading) return;

    const cleanedText = draft.trim();

    if (editingMsg) {
      if (!cleanedText) {
        setLocalError('Edited message cannot be empty.');
        return;
      }
      onEditMessage(editingMsg.id, cleanedText);
      setEditingMsg(null);
      setDraft('');
      setLocalError('');
      return;
    }

    if (!cleanedText && !pendingFile) {
      setLocalError('Write a message, record a voice clip, or attach a file before sending.');
      return;
    }

    if (cleanedText.length > 2000) {
      setLocalError('Message cannot exceed 2000 characters.');
      return;
    }

    let uploadedMedia: MediaAttachment | null = null;
    if (pendingFile) {
      try {
        uploadedMedia = await uploadPendingFile();
        onNotify(
          'media',
          'Upload Complete',
          `${pendingFile.file.name} uploaded and dispatched over TCP.`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'File upload failed.';
        if (msg !== 'Upload cancelled.') {
          setLocalError(msg);
          onNotify('error', 'Upload Failed', msg);
        }
        return;
      }
    }

    onSendMessage({
      conversationId: activeConversationId,
      text: cleanedText,
      mediaId: uploadedMedia?.id,
      replyToId: replyingTo?.id,
    });

    if (cleanedText.includes('🎉')) {
      triggerConfettiBurst(effectsEnabled);
    }

    onTypingChange(activeConversationId, false);
    setDraft('');
    setReplyingTo(null);
    setLocalError('');
    setShowEmojiPicker(false);
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setUploadProgress(0);
    textareaRef.current?.focus();
  };

  const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComposer();
    }
  };

  const handleCopyText = async (msg: ChatMessage) => {
    const content = msg.text || msg.media?.originalFilename || '';
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setReplyingTo(null);
    setDraft(msg.text);
    textareaRef.current?.focus();
  };

  const startReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    setEditingMsg(null);
    textareaRef.current?.focus();
  };

  const getUnreadForDmUser = (username: string): number => {
    const dm = dmConvs.find((c) => c.peerUsername === username);
    return dm?.unreadCount || 0;
  };

  const openUserProfileCard = (username: string) => {
    const found = directory.find((u) => u.username === username);
    if (found) setInspectUser(found);
  };

  const myMood = MOOD_CONFIGS[currentProfile?.presence || 'available'] || MOOD_CONFIGS.available;

  const sidebarBody = (
    <div className="flex h-full flex-col bg-white/85 backdrop-blur-xl dark:bg-[#090c1e]/85">
      {/* Brand + Connection Status */}
      <div className="border-b border-slate-200/80 px-4 py-4 dark:border-violet-500/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 font-display text-sm font-bold text-white shadow-md shadow-violet-600/25">
              TC
            </div>
            <div>
              <p className="font-display text-sm font-bold text-slate-950 dark:text-white">
                TCPChat Studio
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                {connectionStatus === 'connected' ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                    <span className="text-emerald-700 dark:text-emerald-400">
                      WebSocket · TCP Active
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Active User Profile Card */}
      <div className="border-b border-slate-200/80 px-4 py-3.5 dark:border-violet-500/15">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-white/5"
          >
            <Avatar
              name={currentProfile?.displayName || currentUser}
              avatarUrl={currentProfile?.avatarUrl}
              color={currentProfile?.avatarColor}
              size="sm"
              presence={currentProfile?.presence || 'available'}
              showPresence
              animatedRing
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                {currentProfile?.displayName || currentUser}
              </p>
              <p className={`truncate text-[11px] font-medium ${myMood.textClass}`}>
                {myMood.label} · {currentProfile?.statusText || 'Connected'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setThemeModalOpen(true)}
              title="Custom & Conversation Themes"
              aria-label="Customize chat theme"
              className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-cyan-300"
            >
              <Palette className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              title="Profile, Mood & Preferences"
              aria-label="Open profile and settings"
              className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-cyan-300"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Conversations */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Search rooms or peers..."
            aria-label="Search conversations"
            className="w-full rounded-xl border border-slate-200/90 bg-slate-50/90 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#060714]/80 dark:text-white dark:focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Conversation Lists */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {/* Common Room */}
        <div>
          <p className="px-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Common Channel
          </p>
          <button
            type="button"
            onClick={() => {
              onSelectConversation('public');
              setMobileSidebarOpen(false);
            }}
            className={`mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all ${
              activeConversationId === 'public'
                ? 'bg-gradient-to-r from-violet-600/15 to-blue-600/15 text-violet-800 ring-1 ring-violet-500/35 dark:from-violet-600/25 dark:to-cyan-500/20 dark:text-cyan-200 dark:ring-cyan-400/35'
                : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/15 to-blue-600/15 text-violet-600 dark:from-violet-500/30 dark:to-cyan-500/20 dark:text-cyan-300">
                <Hash className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Common Chat Room</p>
                <p className="truncate text-[11px] opacity-75">
                  {publicConv?.lastMessageText || 'Public TCP broadcast'}
                </p>
              </div>
            </div>
            {(publicConv?.unreadCount || 0) > 0 && (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                {publicConv?.unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Group Chats */}
        <div>
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Group Chats ({filteredGroups.length})
            </span>
            <button
              type="button"
              onClick={() => setCreateGroupOpen(true)}
              title="Create new group"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-violet-600 hover:bg-violet-50 dark:text-cyan-300 dark:hover:bg-white/10"
            >
              <Plus className="h-3 w-3" />
              <span>New</span>
            </button>
          </div>

          <div className="mt-1.5 space-y-1">
            {filteredGroups.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                No groups yet. Create one to message multiple peers together.
              </p>
            ) : (
              filteredGroups.map((group) => {
                const active = activeConversationId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      onSelectConversation(group.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-all ${
                      active
                        ? 'bg-gradient-to-r from-violet-600/15 to-blue-600/15 text-violet-800 ring-1 ring-violet-500/35 dark:from-violet-600/25 dark:to-cyan-500/20 dark:text-cyan-200 dark:ring-cyan-400/35'
                        : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        name={group.name}
                        avatarUrl={group.avatarUrl}
                        color="#06B6D4"
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{group.name}</p>
                        <p className="truncate text-[11px] opacity-75">
                          {group.lastMessageText || `${group.members.length} members`}
                        </p>
                      </div>
                    </div>
                    {group.unreadCount > 0 && (
                      <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {group.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Direct Messages / Online Users */}
        <div>
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Peers & Direct Chats
            </span>
            <span className="font-mono text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {onlineCount} online
            </span>
          </div>

          <ul className="mt-1.5 space-y-1">
            {filteredUsers.length === 0 ? (
              <li className="px-2 py-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Open another browser tab as Aman or Priya to test private 1-to-1 messaging.
              </li>
            ) : (
              filteredUsers.map((user) => {
                const dmConv = dmConvs.find((c) => c.peerUsername === user.username);
                const isActive = dmConv ? activeConversationId === dmConv.id : false;
                const unread = getUnreadForDmUser(user.username);
                const moodCfg = MOOD_CONFIGS[user.presence] || MOOD_CONFIGS.offline;

                return (
                  <li key={user.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDm(user.username);
                        setMobileSidebarOpen(false);
                      }}
                      className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600/15 to-blue-600/15 text-violet-800 ring-1 ring-violet-500/35 dark:from-violet-600/25 dark:to-cyan-500/20 dark:text-cyan-200 dark:ring-cyan-400/35'
                          : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                          name={user.displayName}
                          avatarUrl={user.avatarUrl}
                          color={user.avatarColor}
                          size="sm"
                          presence={user.presence}
                          showPresence
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{user.displayName}</p>
                          <p className="truncate text-[11px] opacity-80">
                            {user.isOnline
                              ? `${moodCfg.label}${user.statusText ? ` · ${user.statusText}` : ''}`
                              : `Last seen ${formatLastActive(user.lastActive)}`}
                          </p>
                        </div>
                      </div>
                      {unread > 0 && (
                        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInspectUser(user)}
                      title={`View ${user.displayName}'s card`}
                      aria-label={`View ${user.displayName}'s profile card`}
                      className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-violet-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-white/10 dark:hover:text-cyan-300"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {/* Mini Live Network Activity Widget + Logout */}
      <div className="space-y-2.5 border-t border-slate-200/80 p-3 dark:border-violet-500/15">
        <button
          type="button"
          onClick={onOpenNetworkVisualizer}
          className="w-full rounded-xl border border-slate-200/80 bg-slate-50/90 p-2.5 text-left transition-colors hover:border-violet-400 dark:border-violet-500/20 dark:bg-[#060714]/80 dark:hover:border-cyan-400/50"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-cyan-300">
              <Activity className="h-3.5 w-3.5" />
              <span>Live Network Activity</span>
            </span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {recentPackets.length} pkts
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[10px] text-slate-600 dark:text-slate-400">
            {latestPacket
              ? `${latestPacket.fromUsername} · ${latestPacket.eventType} (${latestPacket.bytes} B)`
              : 'Open Network Visualizer'}
          </p>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300/80 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Logout Session</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 px-2 py-2 sm:px-4 sm:py-4 lg:px-8">
      <div className="mx-auto flex h-[calc(100vh-92px)] min-h-[580px] max-w-[1440px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/75 shadow-2xl shadow-violet-950/10 backdrop-blur-xl dark:border-violet-500/25 dark:bg-[#090c1e]/75">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[308px] shrink-0 border-r border-slate-200/80 lg:block dark:border-violet-500/15">
          {sidebarBody}
        </aside>

        {/* Mobile Sidebar Drawer */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative z-10 w-[308px] max-w-[85vw]">{sidebarBody}</aside>
          </div>
        )}

        {/* Main Chat Pane */}
        <section
          className={`relative flex min-w-0 flex-1 flex-col ${theme.canvasClass}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setIsDraggingOver(false);
          }}
          onDrop={handleDrop}
        >
          {/* Drag and Drop Overlay */}
          {isDraggingOver && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-violet-600/15 backdrop-blur-xs">
              <div className="rounded-2xl border-2 border-dashed border-violet-500 bg-white/95 px-8 py-6 text-center shadow-xl dark:bg-[#0d1026]/95">
                <UploadCloud className="mx-auto h-10 w-10 text-violet-600 dark:text-cyan-400" />
                <p className="mt-2 font-display text-base font-bold text-slate-950 dark:text-white">
                  Drop file to attach to {activeConversation.name}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Images, Videos, Documents (PDF/DOCX/PPTX/XLSX/TXT), or Audio
                </p>
              </div>
            </div>
          )}

          {/* Conversation Top Header */}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3.5 backdrop-blur-xl sm:px-6 dark:border-violet-500/15 dark:bg-[#090c1e]/80">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open conversations sidebar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden dark:border-white/15 dark:bg-slate-900 dark:text-slate-200"
              >
                <Menu className="h-4 w-4" />
              </button>

              {activeConversation.type === 'public' ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm">
                  <Hash className="h-5 w-5" />
                </div>
              ) : activeConversation.type === 'private' ? (
                <Avatar
                  name={activeConversation.name}
                  avatarUrl={activeConversation.avatarUrl}
                  color="#7C3AED"
                  size="md"
                  presence={activeConversation.peerPresence || 'offline'}
                  showPresence
                  onClick={() =>
                    activeConversation.peerUsername &&
                    openUserProfileCard(activeConversation.peerUsername)
                  }
                />
              ) : (
                <Avatar
                  name={activeConversation.name}
                  avatarUrl={activeConversation.avatarUrl}
                  color="#06B6D4"
                  size="md"
                />
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-display text-base font-bold text-slate-950 sm:text-lg dark:text-white">
                    {activeConversation.name}
                  </h1>
                  {activeConversation.type === 'private' && (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-cyan-400" />
                  )}
                </div>

                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {typingUsers.length > 0 ? (
                    <span className="font-semibold text-violet-600 dark:text-cyan-300">
                      {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </span>
                  ) : activeConversation.type === 'public' ? (
                    `${onlineCount} ${onlineCount === 1 ? 'client' : 'clients'} connected over TCP`
                  ) : activeConversation.type === 'group' ? (
                    `${activeConversation.members.length} group members`
                  ) : activeConversation.peerIsOnline ? (
                    `${(MOOD_CONFIGS[activeConversation.peerPresence || 'available'] || MOOD_CONFIGS.available).label} · Direct Private Channel`
                  ) : activeConversation.peerLastActive ? (
                    `Offline · Last active ${formatLastActive(activeConversation.peerLastActive)}`
                  ) : (
                    'Private 1-to-1 Conversation'
                  )}
                </p>
              </div>
            </div>

            {/* Header Tools */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                aria-label="Toggle sound effects"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                  soundEnabled
                    ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/35 dark:bg-violet-950/50 dark:text-cyan-300'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={onToggleEffects}
                title={effectsEnabled ? 'Disable confetti & particle effects' : 'Enable visual effects'}
                aria-label="Toggle celebration and background effects"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                  effectsEnabled
                    ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/35 dark:bg-violet-950/50 dark:text-cyan-300'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <Sparkles className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                title="Search messages"
                aria-label="Search messages in conversation"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                  searchOpen
                    ? 'border-violet-600 bg-violet-50 text-violet-700 dark:border-cyan-400 dark:bg-violet-950/60 dark:text-cyan-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Search className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setMediaModalState({ open: true, tab: 'gallery' })}
                title="Media Gallery"
                aria-label="Open Media Gallery"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ImageIcon className="h-4 w-4 text-violet-600 dark:text-cyan-400" />
                <span className="hidden sm:inline">Gallery</span>
              </button>

              <button
                type="button"
                onClick={() => setMediaModalState({ open: true, tab: 'files' })}
                title="File Manager"
                aria-label="Open File Manager"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Files</span>
              </button>

              {activeConversation.type === 'group' && (
                <button
                  type="button"
                  onClick={() => setGroupInfoOpen(true)}
                  title="Group Members & Settings"
                  aria-label="Open group members"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden md:inline">Members</span>
                </button>
              )}
            </div>
          </header>

          {/* Message Spotlight / Pinned Message Bar */}
          {activePinned && (
            <div className="flex items-center justify-between gap-3 border-b border-violet-200/80 bg-violet-50/85 px-4 py-2 text-xs backdrop-blur-md sm:px-6 dark:border-violet-500/20 dark:bg-violet-950/40">
              <button
                type="button"
                onClick={() => {
                  scrollToMessage(activePinned.id);
                  if (pinnedMessages.length > 1) {
                    setPinnedIdx((p) => (p + 1) % pinnedMessages.length);
                  }
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Pin className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-cyan-300" />
                <span className="shrink-0 font-semibold text-violet-700 dark:text-cyan-300">
                  Spotlight ({(pinnedIdx % pinnedMessages.length) + 1}/{pinnedMessages.length}):
                </span>
                <span className="truncate text-slate-800 dark:text-slate-200">
                  <strong>{activePinned.sender}:</strong>{' '}
                  {activePinned.text || activePinned.media?.originalFilename}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onTogglePin(activePinned.id)}
                title="Unpin spotlight message"
                aria-label="Unpin spotlight message"
                className="rounded-lg p-1 text-slate-500 hover:bg-black/5 dark:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Collapsible Message Search Bar */}
          {searchOpen && (
            <div className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-[#090c1e]/90">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages or filenames by keyword..."
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {searchQuery.trim() && (
                <div className="mt-2.5 max-h-40 space-y-1.5 overflow-y-auto border-t border-slate-200/70 pt-2 dark:border-white/10">
                  {searching ? (
                    <p className="text-xs text-slate-500">Searching SQLite message index...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-slate-500">No matching messages found.</p>
                  ) : (
                    searchResults.map((resMsg) => (
                      <button
                        key={resMsg.id}
                        type="button"
                        onClick={() => {
                          scrollToMessage(resMsg.id);
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="truncate">
                          <strong className="text-slate-900 dark:text-white">
                            {resMsg.sender}:
                          </strong>{' '}
                          <span className="text-slate-600 dark:text-slate-300">
                            {resMsg.text || resMsg.media?.originalFilename}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-slate-400">
                          {resMsg.timestamp}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages Viewport */}
          <div
            ref={streamRef}
            onScroll={handleStreamScroll}
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-md dark:border-violet-500/25 dark:bg-slate-900/80">
                  {activeConversation.type === 'private' ? (
                    <Lock className="h-6 w-6 text-violet-600 dark:text-cyan-400" />
                  ) : activeConversation.type === 'group' ? (
                    <Users className="h-6 w-6 text-violet-600 dark:text-cyan-400" />
                  ) : (
                    <Hash className="h-6 w-6 text-violet-600 dark:text-cyan-400" />
                  )}
                </div>
                <p className="mt-4 font-display text-base font-bold text-slate-950 dark:text-white">
                  Start the conversation in {activeConversation.name}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Send messages, record live voice notes, drag & drop photos/videos/documents, or
                  celebrate with 🎉.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className="flex items-center justify-center gap-2 py-1 text-center text-xs text-slate-500 dark:text-slate-400"
                    >
                      <span className="rounded-xl border border-slate-200/60 bg-white/75 px-3 py-1 backdrop-blur-xs dark:border-white/10 dark:bg-slate-900/60">
                        {msg.text} · <span className="font-mono tabular-nums">{msg.timestamp}</span>
                      </span>
                    </div>
                  );
                }

                const isOwn = msg.sender === currentUser;
                const canDelete =
                  !msg.deleted &&
                  (isOwn ||
                    (activeConversation.type === 'group' &&
                      activeConversation.members.some(
                        (m) => m.username === currentUser && m.role === 'admin',
                      )));

                return (
                  <motion.div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className={`group flex items-end gap-2.5 ${
                      isOwn ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {!isOwn && (
                      <Avatar
                        name={msg.senderDisplayName || msg.sender}
                        avatarUrl={msg.senderAvatarUrl}
                        color={msg.senderAvatarColor}
                        size="sm"
                        onClick={() => openUserProfileCard(msg.sender)}
                      />
                    )}

                    <div
                      className={`relative max-w-[85%] sm:max-w-[70%] ${
                        isOwn ? 'items-end' : 'items-start'
                      } flex flex-col`}
                    >
                      {/* Bubble */}
                      <div
                        className={`rounded-2xl border px-4 py-2.5 transition-all ${
                          msg.deleted
                            ? 'border-slate-200/80 bg-slate-100/80 italic text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400'
                            : isOwn
                              ? theme.ownBubbleClass
                              : theme.otherBubbleClass
                        } ${msg.pinned && !msg.deleted ? 'ring-2 ring-amber-400/70' : ''}`}
                      >
                        {/* Sender & Timestamp */}
                        <div
                          className={`flex items-center justify-between gap-4 text-[11px] ${
                            isOwn && !msg.deleted
                              ? 'text-white/85'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openUserProfileCard(msg.sender)}
                            className="font-semibold hover:underline"
                          >
                            {isOwn ? 'You' : msg.senderDisplayName || msg.sender}
                          </button>

                          <span className="flex items-center gap-1.5 font-mono tabular-nums">
                            {msg.pinned && !msg.deleted && (
                              <Pin className="h-3 w-3 text-amber-300" />
                            )}
                            {msg.edited && !msg.deleted && <span>(edited)</span>}
                            <span>{msg.timestamp}</span>
                            {isOwn && !msg.deleted && (
                              <span
                                title={
                                  msg.deliveryStatus === 'read'
                                    ? `Read by ${msg.readBy.join(', ')}`
                                    : msg.deliveryStatus === 'delivered'
                                      ? 'Delivered'
                                      : 'Sent'
                                }
                                className="inline-flex items-center"
                              >
                                {msg.deliveryStatus === 'read' ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-cyan-200" />
                                ) : msg.deliveryStatus === 'delivered' ? (
                                  <CheckCheck className="h-3.5 w-3.5 opacity-85" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 opacity-80" />
                                )}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Reply Quote Preview */}
                        {msg.replyTo && !msg.deleted && (
                          <button
                            type="button"
                            onClick={() => scrollToMessage(msg.replyTo!.id)}
                            className={`mt-1.5 block w-full rounded-xl px-2.5 py-1.5 text-left text-xs transition-opacity hover:opacity-90 ${
                              isOwn
                                ? 'bg-black/20 text-white/95'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-900/90 dark:text-slate-300'
                            }`}
                          >
                            <p className="font-semibold">Replying to {msg.replyTo.sender}</p>
                            <p className="truncate opacity-80">{msg.replyTo.text}</p>
                          </button>
                        )}

                        {/* Message Text */}
                        {msg.text && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {msg.text}
                          </p>
                        )}

                        {/* Media Attachment */}
                        {msg.media && !msg.deleted && (
                          <MediaMessage
                            media={msg.media}
                            authToken={authToken}
                            isOwn={isOwn}
                            onOpenLightbox={setLightboxMedia}
                          />
                        )}
                      </div>

                      {/* Reactions Display Beneath Bubble */}
                      {msg.reactions.length > 0 && !msg.deleted && (
                        <div
                          className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${
                            isOwn ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {msg.reactions.map((r) => {
                            const reacted = r.users.includes(currentUser);
                            return (
                              <motion.button
                                key={r.emoji}
                                type="button"
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => onToggleReaction(msg.id, r.emoji)}
                                title={`${r.emoji} reacted by ${r.users.join(', ')}`}
                                aria-label={`Toggle ${r.emoji} reaction (${r.users.length})`}
                                aria-pressed={reacted}
                                className={`inline-flex items-center gap-1 rounded-xl border px-2 py-0.5 text-xs shadow-xs backdrop-blur-xs transition-all hover:scale-105 active:scale-95 ${
                                  reacted
                                    ? 'border-violet-500/80 bg-violet-100/90 text-violet-800 dark:border-cyan-400/80 dark:bg-violet-900/60 dark:text-cyan-200'
                                    : 'border-slate-200/90 bg-white/90 text-slate-700 hover:border-violet-300 hover:bg-white dark:border-white/15 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:border-cyan-400/40'
                                }`}
                              >
                                <span className="text-sm leading-none">{r.emoji}</span>
                                <span className="font-mono text-[10px] font-semibold tabular-nums">
                                  {r.users.length}
                                </span>
                              </motion.button>
                            );
                          })}

                          <button
                            type="button"
                            data-reaction-trigger={msg.id}
                            onClick={() =>
                              setReactionTargetId((prev) => (prev === msg.id ? null : msg.id))
                            }
                            title="Add another reaction"
                            aria-label="Add reaction to message"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-xl border border-slate-200/90 bg-white/85 text-slate-500 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-white/15 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-cyan-400/50 dark:hover:text-cyan-300"
                          >
                            <SmilePlus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Message Action Toolbar */}
                      {!msg.deleted && (
                        <div
                          className={`mt-1 flex items-center gap-1 transition-opacity duration-150 ${
                            reactionTargetId === msg.id
                              ? 'opacity-100'
                              : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            data-reaction-trigger={msg.id}
                            onClick={() =>
                              setReactionTargetId((prev) => (prev === msg.id ? null : msg.id))
                            }
                            title="React"
                            aria-label="React to message"
                            aria-expanded={reactionTargetId === msg.id}
                            className={`rounded-lg p-1.5 shadow-xs ring-1 transition-colors ${
                              reactionTargetId === msg.id
                                ? 'bg-violet-600 text-white ring-violet-500 dark:bg-cyan-500 dark:text-slate-950 dark:ring-cyan-400'
                                : 'bg-white/90 text-slate-600 ring-slate-200/80 hover:text-violet-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10 dark:hover:text-cyan-300'
                            }`}
                          >
                            <SmilePlus className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => startReply(msg)}
                            title="Reply"
                            aria-label="Reply to message"
                            className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-xs ring-1 ring-slate-200/80 hover:text-violet-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10 dark:hover:text-cyan-300"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onTogglePin(msg.id)}
                            title={msg.pinned ? 'Unpin from Spotlight' : 'Pin to Spotlight'}
                            aria-label={msg.pinned ? 'Unpin message' : 'Pin message'}
                            className={`rounded-lg bg-white/90 p-1.5 shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-white/10 ${
                              msg.pinned
                                ? 'text-amber-500'
                                : 'text-slate-600 hover:text-amber-500 dark:text-slate-300'
                            }`}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>

                          {(msg.text || msg.media) && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg)}
                              title="Copy message"
                              aria-label="Copy message"
                              className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-xs ring-1 ring-slate-200/80 hover:text-violet-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10 dark:hover:text-cyan-300"
                            >
                              {copiedId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}

                          {isOwn && msg.type === 'text' && (
                            <button
                              type="button"
                              onClick={() => startEdit(msg)}
                              title="Edit message"
                              aria-label="Edit message"
                              className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-xs ring-1 ring-slate-200/80 hover:text-violet-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10 dark:hover:text-cyan-300"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDeleteMessage(msg.id)}
                              title="Delete message"
                              aria-label="Delete message"
                              className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow-xs ring-1 ring-slate-200/80 hover:bg-red-50 dark:bg-slate-900 dark:text-red-400 dark:ring-white/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Interactive Reaction Picker Popover */}
                      <AnimatePresence>
                        {reactionTargetId === msg.id && !msg.deleted && (
                          <ReactionPicker
                            messageId={msg.id}
                            selectedEmojis={msg.reactions
                              .filter((r) => r.users.includes(currentUser))
                              .map((r) => r.emoji)}
                            align={isOwn ? 'right' : 'left'}
                            onSelect={(emoji) => {
                              onToggleReaction(msg.id, emoji);
                              setReactionTargetId(null);
                            }}
                            onClose={() => setReactionTargetId(null)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}

            {/* Animated 3-dot Typing Indicator Bubble */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/85 px-3.5 py-2 text-xs text-slate-600 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
                  </span>
                  <span className="font-medium">
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Jump to Latest Button */}
          {showJumpToLatest && (
            <button
              type="button"
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              aria-label="Scroll to latest message"
              className="absolute bottom-28 right-6 z-20 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur-md hover:bg-slate-100 dark:border-white/15 dark:bg-[#0d1026]/95 dark:text-slate-100"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              <span>Latest</span>
            </button>
          )}

          {/* Bottom Composer Stack */}
          <div className="border-t border-slate-200/80 bg-white/85 p-3.5 backdrop-blur-xl sm:px-5 dark:border-violet-500/15 dark:bg-[#090c1e]/85">
            {activeError && (
              <div
                role="alert"
                className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{activeError}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLocalError('');
                    onClearChatError();
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Reply / Edit Context Banner */}
            {(replyingTo || editingMsg) && (
              <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/80 px-3.5 py-2 text-xs dark:border-violet-500/30 dark:bg-violet-950/40">
                <div className="min-w-0">
                  <p className="font-semibold text-violet-700 dark:text-cyan-300">
                    {editingMsg
                      ? 'Editing your message'
                      : `Replying to ${replyingTo?.senderDisplayName || replyingTo?.sender}`}
                  </p>
                  <p className="truncate text-slate-600 dark:text-slate-300">
                    {editingMsg
                      ? editingMsg.text
                      : replyingTo?.text || replyingTo?.media?.originalFilename}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setEditingMsg(null);
                    if (editingMsg) setDraft('');
                  }}
                  aria-label="Cancel reply or edit"
                  className="rounded-lg p-1 text-slate-500 hover:bg-black/5 dark:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Live Voice Recording Banner */}
            {isRecording && (
              <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50/90 px-3.5 py-2.5 text-xs dark:border-rose-500/40 dark:bg-rose-950/40">
                <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  <span className="font-semibold">Recording Voice Clip...</span>
                  <span className="font-mono tabular-nums">{formatDuration(recordingSec)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(true)}
                    className="rounded-lg border border-rose-300 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700"
                  >
                    <Square className="h-3 w-3" />
                    <span>Attach Clip</span>
                  </button>
                </div>
              </div>
            )}

            {/* Pre-Send File Preview & Upload Progress */}
            {pendingFile && (
              <div className="mb-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/15 dark:bg-[#060714]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {pendingFile.category === 'image' && pendingFile.previewUrl ? (
                      <img
                        src={pendingFile.previewUrl}
                        alt={pendingFile.file.name}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : pendingFile.category === 'video' && pendingFile.previewUrl ? (
                      <video
                        src={pendingFile.previewUrl}
                        className="h-12 w-16 rounded-xl bg-black object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 text-violet-600 dark:bg-violet-500/20 dark:text-cyan-300">
                        {pendingFile.category === 'audio' ? (
                          <Music className="h-5 w-5" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                        {pendingFile.file.name}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {pendingFile.category.toUpperCase()} · {formatBytes(pendingFile.file.size)}
                        {pendingFile.durationSec ? ` · ${formatDuration(pendingFile.durationSec)}` : ''}
                        {isUploading ? ` · Uploading ${uploadProgress}%` : ' · Ready to send'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={cancelPendingUpload}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{isUploading ? 'Cancel' : 'Remove'}</span>
                  </button>
                </div>

                {isUploading && (
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      style={{ width: `${uploadProgress}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 transition-all duration-150"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Attachment & Emoji Popovers + Input Row */}
            <div className="relative flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {/* Attachment Menu Popover */}
              {showAttachMenu && (
                <div className="absolute bottom-14 left-0 z-30 w-56 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-[#0d1026]/95">
                  <button
                    type="button"
                    onClick={() => openFilePicker('image')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <ImageIcon className="h-4 w-4 text-violet-500" />
                    <span>Photos (JPG, PNG, WEBP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFilePicker('video')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Film className="h-4 w-4 text-blue-500" />
                    <span>Videos (MP4, WEBM)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFilePicker('document')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <FileText className="h-4 w-4 text-emerald-500" />
                    <span>Documents (PDF, DOC, XLS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFilePicker('audio')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Music className="h-4 w-4 text-amber-500" />
                    <span>Audio (MP3, WAV, OGG)</span>
                  </button>
                </div>
              )}

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-14 left-10 z-30 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-[#0d1026]/95">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-lg p-1.5 text-lg transition-transform hover:scale-115 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={Boolean(editingMsg) || connectionStatus !== 'connected'}
                onClick={() => {
                  setShowAttachMenu((p) => !p);
                  setShowEmojiPicker(false);
                }}
                title="Attach file"
                aria-label="Attach photo, video, document, or audio"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={connectionStatus !== 'connected'}
                onClick={() => {
                  setShowEmojiPicker((p) => !p);
                  setShowAttachMenu(false);
                }}
                title="Insert emoji"
                aria-label="Insert emoji"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400"
              >
                <Smile className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={Boolean(editingMsg) || connectionStatus !== 'connected'}
                onClick={() => (isRecording ? stopVoiceRecording(false) : startVoiceRecording())}
                title={isRecording ? 'Stop & attach voice note' : 'Record voice message'}
                aria-label={isRecording ? 'Stop voice recording' : 'Record voice message'}
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
                  isRecording
                    ? 'border-rose-500 bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-violet-400 hover:text-violet-600 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400'
                }`}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <div
                className={`flex min-w-0 flex-1 items-center rounded-xl border border-slate-300 bg-white transition-all dark:border-white/15 dark:bg-[#060714] ${theme.accentRingClass}`}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={
                    editingMsg
                      ? 'Edit your message...'
                      : `Message ${activeConversation.name}...`
                  }
                  disabled={connectionStatus !== 'connected'}
                  aria-label="Message composer"
                  className="max-h-32 min-h-[42px] w-full resize-none bg-transparent px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              <button
                type="button"
                disabled={isUploading || connectionStatus !== 'connected'}
                onClick={submitComposer}
                aria-label={editingMsg ? 'Save edited message' : 'Send message'}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{editingMsg ? 'Save' : 'Send'}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modals */}
      <ImageLightboxModal
        media={lightboxMedia}
        authToken={authToken}
        onClose={() => setLightboxMedia(null)}
      />

      <UserCardModal
        user={inspectUser}
        currentUser={currentUser}
        onClose={() => setInspectUser(null)}
        onStartPrivateChat={(uname) => {
          onOpenDm(uname);
          setMobileSidebarOpen(false);
        }}
      />

      <ProfileSettingsModal
        open={profileModalOpen}
        profile={currentProfile}
        socketId={socketId}
        authToken={authToken}
        soundEnabled={soundEnabled}
        effectsEnabled={effectsEnabled}
        onToggleSound={onToggleSound}
        onToggleEffects={onToggleEffects}
        onClose={() => setProfileModalOpen(false)}
        onSaveProfile={onUpdateProfile}
        onAvatarUpdated={() =>
          onNotify('system', 'Photo Updated', 'Profile picture saved and synced across clients.')
        }
        onNotifyError={(msg) => onNotify('error', 'Profile Error', msg)}
      />

      <ThemeCustomizerModal
        open={themeModalOpen}
        globalTheme={chatTheme}
        conversationTheme={perConvThemeId}
        conversationName={activeConversation.name}
        onSelectGlobalTheme={onChangeChatTheme}
        onSelectConversationTheme={(t) => onChangeConversationTheme(activeConversationId, t)}
        onResetConversationTheme={() => onChangeConversationTheme(activeConversationId, null)}
        onClose={() => setThemeModalOpen(false)}
      />

      <CreateGroupModal
        open={createGroupOpen}
        directory={directory}
        currentUser={currentUser}
        onClose={() => setCreateGroupOpen(false)}
        onCreateGroup={onCreateGroup}
      />

      <GroupInfoModal
        open={groupInfoOpen}
        group={activeConversation}
        currentUserId={currentProfile?.id || ''}
        directory={directory}
        authToken={authToken}
        onClose={() => setGroupInfoOpen(false)}
        onAddMember={onAddGroupMember}
        onRemoveMember={onRemoveGroupMember}
        onAvatarUpdated={() =>
          onNotify('group', 'Group Photo Updated', 'Group picture synced with all members.')
        }
        onNotifyError={(msg) => onNotify('error', 'Group Update Failed', msg)}
      />

      <MediaAndFilesModal
        open={mediaModalState.open}
        initialTab={mediaModalState.tab}
        conversationId={activeConversationId}
        conversationName={activeConversation.name}
        authToken={authToken}
        onClose={() => setMediaModalState((prev) => ({ ...prev, open: false }))}
        onOpenLightbox={setLightboxMedia}
      />
    </div>
  );
}
