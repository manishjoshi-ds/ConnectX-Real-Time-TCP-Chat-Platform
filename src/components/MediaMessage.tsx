import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  Maximize2,
  Pause,
  Play,
  Presentation,
} from 'lucide-react';
import type { MediaAttachment } from '../types/chat';
import { formatBytes, formatDuration, withAuthToken } from '../utils/format';

interface MediaMessageProps {
  media: MediaAttachment;
  authToken: string;
  isOwn: boolean;
  onOpenLightbox: (media: MediaAttachment) => void;
}

function getDocumentStyle(ext: string) {
  const upper = ext.toUpperCase();
  if (upper === 'PDF') {
    return {
      Icon: FileText,
      badgeClass: 'bg-rose-500/15 text-rose-500 dark:bg-rose-500/20 dark:text-rose-300',
      label: 'PDF Document',
    };
  }
  if (upper === 'DOC' || upper === 'DOCX') {
    return {
      Icon: FileText,
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
      label: 'Word Document',
    };
  }
  if (upper === 'XLS' || upper === 'XLSX') {
    return {
      Icon: FileSpreadsheet,
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
      label: 'Excel Spreadsheet',
    };
  }
  if (upper === 'PPT' || upper === 'PPTX') {
    return {
      Icon: Presentation,
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
      label: 'PowerPoint Deck',
    };
  }
  if (upper === 'TXT') {
    return {
      Icon: FileText,
      badgeClass: 'bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
      label: 'Text File',
    };
  }
  return {
    Icon: FileArchive,
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
    label: 'Attachment',
  };
}

export function MediaMessage({ media, authToken, isOwn, onOpenLightbox }: MediaMessageProps) {
  const srcUrl = withAuthToken(media.url, authToken);
  const downloadUrl = withAuthToken(media.downloadUrl, authToken);

  if (media.mediaType === 'image') {
    return (
      <div className="mt-2 space-y-2">
        <div className="group relative overflow-hidden rounded-xl border border-black/10 bg-slate-950/10 shadow-sm dark:border-white/15">
          <img
            src={srcUrl}
            alt={media.originalFilename}
            referrerPolicy="no-referrer"
            onClick={() => onOpenLightbox(media)}
            className="max-h-72 w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onOpenLightbox(media)}
              title="Open full screen"
              aria-label="Open image in full screen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950/80 text-white backdrop-blur-md hover:bg-violet-600"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <a
              href={downloadUrl}
              download={media.originalFilename}
              title="Download image"
              aria-label="Download image"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950/80 text-white backdrop-blur-md hover:bg-violet-600"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div
          className={`flex items-center justify-between gap-3 text-[11px] ${
            isOwn ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span className="truncate">{media.originalFilename}</span>
          <span className="shrink-0 font-mono tabular-nums">{formatBytes(media.sizeBytes)}</span>
        </div>
      </div>
    );
  }

  if (media.mediaType === 'video') {
    return (
      <VideoAttachmentCard media={media} srcUrl={srcUrl} downloadUrl={downloadUrl} isOwn={isOwn} />
    );
  }

  if (media.mediaType === 'audio') {
    return <AudioAttachmentCard media={media} srcUrl={srcUrl} downloadUrl={downloadUrl} isOwn={isOwn} />;
  }

  // Document card with format-specific icon & color
  const { Icon: DocIcon, badgeClass, label } = getDocumentStyle(media.extension);
  return (
    <div
      className={`mt-2 flex items-center gap-3 rounded-xl border p-3 transition-transform duration-150 hover:scale-[1.01] ${
        isOwn
          ? 'border-white/20 bg-white/12 text-white backdrop-blur-md'
          : 'border-slate-200/90 bg-slate-50/90 text-slate-900 dark:border-white/10 dark:bg-[#060714]/70 dark:text-slate-100'
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          isOwn ? 'bg-white/20 text-white' : badgeClass
        }`}
      >
        <DocIcon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{media.originalFilename}</p>
        <p
          className={`mt-0.5 font-mono text-[11px] tabular-nums ${
            isOwn ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {label} · {media.extension} · {formatBytes(media.sizeBytes)}
        </p>
      </div>

      <a
        href={downloadUrl}
        download={media.originalFilename}
        aria-label={`Download ${media.originalFilename}`}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
          isOwn
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-violet-50 hover:text-violet-700 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-700'
        }`}
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

function VideoAttachmentCard({
  media,
  srcUrl,
  downloadUrl,
  isOwn,
}: {
  media: MediaAttachment;
  srcUrl: string;
  downloadUrl: string;
  isOwn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="group relative overflow-hidden rounded-xl border border-black/15 bg-black shadow-md dark:border-white/15">
        <video
          ref={videoRef}
          src={srcUrl}
          controls
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="max-h-72 w-full bg-black object-contain"
        />
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play video"
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-violet-600"
          >
            <Film className="h-3.5 w-3.5 text-cyan-300" />
            <span>Play Video</span>
          </button>
        )}
      </div>
      <div
        className={`flex items-center justify-between gap-3 text-[11px] ${
          isOwn ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <span className="truncate font-mono tabular-nums">
          {media.originalFilename}
          {media.durationSec ? ` · ${formatDuration(media.durationSec)}` : ''} ·{' '}
          {formatBytes(media.sizeBytes)}
        </span>
        <a
          href={downloadUrl}
          download={media.originalFilename}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
            isOwn
              ? 'bg-white/20 text-white hover:bg-white/30'
              : 'bg-slate-200/80 text-slate-800 hover:bg-slate-300/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Download className="h-3 w-3" />
          <span>Download</span>
        </a>
      </div>
    </div>
  );
}

function AudioAttachmentCard({
  media,
  srcUrl,
  downloadUrl,
  isOwn,
}: {
  media: MediaAttachment;
  srcUrl: string;
  downloadUrl: string;
  isOwn: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(media.durationSec || 0);

  // Deterministic waveform heights based on attachment ID
  const bars = useMemo(() => {
    const seed = media.id || media.originalFilename || 'audio';
    return Array.from({ length: 24 }, (_, idx) => {
      const code = seed.charCodeAt(idx % seed.length) + idx * 17;
      return 28 + (code % 68);
    });
  }, [media.id, media.originalFilename]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onEnded = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`mt-2 flex items-center gap-3 rounded-xl border p-3 ${
        isOwn
          ? 'border-white/20 bg-white/12 text-white backdrop-blur-md'
          : 'border-slate-200/90 bg-slate-50/90 text-slate-900 dark:border-white/10 dark:bg-[#060714]/70 dark:text-slate-100'
      }`}
    >
      <audio ref={audioRef} src={srcUrl} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause audio' : 'Play audio'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95 ${
          isOwn
            ? 'bg-white text-violet-700 hover:bg-violet-50'
            : 'bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm'
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{media.originalFilename}</p>

        {/* Animated Waveform Visualization */}
        <div
          className="mt-2 flex h-7 items-end gap-[3px] cursor-pointer"
          onClick={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            el.currentTime = ratio * duration;
            setCurrentTime(el.currentTime);
          }}
          title="Click waveform to seek"
        >
          {bars.map((heightPct, idx) => {
            const barPct = ((idx + 1) / bars.length) * 100;
            const filled = barPct <= progress;
            return (
              <span
                key={idx}
                style={{
                  height: `${playing ? Math.max(25, ((heightPct + ((idx * 13) % 24)) % 95)) : heightPct}%`,
                }}
                className={`flex-1 rounded-full transition-all duration-200 ${
                  filled
                    ? isOwn
                      ? 'bg-white'
                      : 'bg-violet-600 dark:bg-cyan-400'
                    : isOwn
                      ? 'bg-white/35'
                      : 'bg-slate-300 dark:bg-slate-700'
                } ${playing ? 'animate-pulse' : ''}`}
              />
            );
          })}
        </div>

        <div
          className={`mt-1 flex items-center justify-between font-mono text-[10px] tabular-nums ${
            isOwn ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
          <span>{formatBytes(media.sizeBytes)}</span>
        </div>
      </div>

      <a
        href={downloadUrl}
        download={media.originalFilename}
        aria-label={`Download ${media.originalFilename}`}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
          isOwn
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-violet-50 hover:text-violet-700 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-700'
        }`}
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
