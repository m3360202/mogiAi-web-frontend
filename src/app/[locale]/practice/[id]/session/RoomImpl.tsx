"use client";

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from '@/i18n/routing';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Settings, X,
  MessageSquare, BarChart2, User, Users,
  Play, Pause, Square, Timer, Volume2, Send, Phone, PhoneOff, Bot, Loader2, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { DiscussionVirtualUsers, type DiscussionVirtualRole } from './DiscussionVirtualUsers';
import { getApiBaseUrl, getWsBaseUrl } from '@/lib/publicConfig';
import { getDiscussionLanguage, getDiscussionSpeechLocale } from '@/lib/discussionVoicePresets';
import { getSupabaseClient } from '@/lib/supabaseClient';

export type RoomMode = 'interview' | 'discussion';
type SessionLanguage = 'zh' | 'ja' | 'en';

function normalizeSessionLanguage(value: string | null | undefined): SessionLanguage {
  const lang = (value || '').toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('en')) return 'en';
  return 'ja';
}

function toSpeechLangTag(language: SessionLanguage): string {
  if (language === 'zh') return 'zh-CN';
  if (language === 'en') return 'en-US';
  return 'ja-JP';
}

function createClientSessionId(prefix: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = (typeof window !== 'undefined' ? (window as any).crypto : undefined);
    if (c?.randomUUID) return `${prefix}-${c.randomUUID()}`;
  } catch {
    // ignore
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function RoomImpl(props: { mode: RoomMode }) {
  const t = useTranslations('practice');
  const router = useRouter();
  const params = useParams<{ id: string | string[]; locale?: string | string[] }>();
  const searchParams = useSearchParams();
  const isDiscussionMode = props.mode === 'discussion';
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const locale = Array.isArray(params?.locale) ? params?.locale[0] : params?.locale;
  const sessionLanguage = normalizeSessionLanguage(searchParams.get('language') || locale || null);
  const authUser = useAuthStore((state) => state.user);
  const authSession = useAuthStore((state) => state.session);

  // States for simulation
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionHint, setQuestionHint] = useState('');
  const [qaHistory, setQaHistory] = useState<Array<{ kind: 'system' | 'self' | 'other'; text: string; speaker?: string }>>([]);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [isQuestionPlaying, setIsQuestionPlaying] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Realtime room state
  const [participants, setParticipants] = useState<Array<{ user_id: string; display_name: string; role: string }>>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [speakQueue, setSpeakQueue] = useState<string[]>([]);
  const [discussionDeadlineAt, setDiscussionDeadlineAt] = useState<number | null>(null); // epoch seconds
  const [discussionTimeLeftSec, setDiscussionTimeLeftSec] = useState<number | null>(null);
  const [discussionResultReady, setDiscussionResultReady] = useState<boolean>(false);
  const [discussionRoles, setDiscussionRoles] = useState<DiscussionVirtualRole[]>([]);
  const [discussionPhase, setDiscussionPhase] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ user_id: string; display_name: string; text: string }>>([]);
  const [chatText, setChatText] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const remoteAudioElsRef = useRef<Record<string, HTMLAudioElement>>({});
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const spokenUsersRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scheduledAudioStartRef = useRef<NodeJS.Timeout | null>(null);
  const questionPlayingWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenQuestionRef = useRef<string | null>(null);
  const lastAiSpeakKeyRef = useRef<string | null>(null);
  const ttsUrlCacheRef = useRef<Map<string, string>>(new Map());
  const voicesChangedHandlerRef = useRef<(() => void) | null>(null);
  const historySessionIdRef = useRef<string>(createClientSessionId('history'));
  const historyStartedAtRef = useRef<string>(new Date().toISOString());
  const historyPersistedRef = useRef(false);
  const syncedVideoCountRef = useRef(0);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<BlobPart[]>([]);
  const uploadedVideoUrlsRef = useRef<string[]>([]);
  const nextVideoSegmentRef = useRef<number>(1);
  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef(false);
  const currentAnswerRef = useRef<string[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const historyEndRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const answerStartAtRef = useRef<number | null>(null);
  const [currentVolumeNorm, setCurrentVolumeNorm] = useState<number>(0);
  const [answerMetrics, setAnswerMetrics] = useState<
    Array<{
      timestamp: number;
      durationSec: number;
      wordCount: number;
      wpm: number | null;
      avgVolumeNorm: number | null; // 0..1
      peakVolumeNorm: number | null; // 0..1
    }>
  >([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const volumeRafRef = useRef<number | null>(null);
  const volumeSumRef = useRef<number>(0);
  const volumeSamplesRef = useRef<number>(0);
  const volumePeakRef = useRef<number>(0);
  const lastVolumeUiUpdateRef = useRef<number>(0);
  const volumeStreamRef = useRef<MediaStream | null>(null);
  const volumeStreamOwnedRef = useRef<boolean>(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const countWords = (text: string) => {
    const s = (text || '').trim();
    if (!s) return 0;
    try {
      const Seg = (Intl as any)?.Segmenter;
      if (typeof Seg === 'function') {
        const seg = new Seg(undefined, { granularity: 'word' });
        let c = 0;
        for (const part of seg.segment(s)) {
          if ((part as any)?.isWordLike) c += 1;
        }
        if (c > 0) return c;
      }
    } catch {
      // ignore
    }
    const ws = s.split(/\s+/).filter(Boolean);
    if (ws.length > 1) return ws.length;
    // CJK fallback: treat non-space chars as "units"
    return s.replace(/\s/g, '').length;
  };

  const stopVolumeMonitoring = () => {
    if (volumeRafRef.current) {
      cancelAnimationFrame(volumeRafRef.current);
      volumeRafRef.current = null;
    }
    analyserRef.current = null;
    analyserBufRef.current = null;
    setCurrentVolumeNorm(0);
  };

  const startVolumeMonitoring = async () => {
    stopVolumeMonitoring();
    volumeSumRef.current = 0;
    volumeSamplesRef.current = 0;
    volumePeakRef.current = 0;
    lastVolumeUiUpdateRef.current = 0;

    try {
      let streamToUse: MediaStream | null = null;
      let owned = false;

      if (localStream?.getAudioTracks?.().length) {
        streamToUse = localStream;
      } else {
        // If WebRTC stream isn't available, request mic-only for local analysis.
        streamToUse = await navigator.mediaDevices.getUserMedia({ audio: true });
        owned = true;
      }

      if (!streamToUse?.getAudioTracks?.().length) return;
      volumeStreamRef.current = streamToUse;
      volumeStreamOwnedRef.current = owned;

      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx: AudioContext = audioCtxRef.current ?? new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(streamToUse);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      analyserRef.current = analyser;
      analyserBufRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

      const tick = () => {
        if (!analyserRef.current || !analyserBufRef.current) return;
        analyserRef.current.getFloatTimeDomainData(analyserBufRef.current);

        let sumSq = 0;
        for (let i = 0; i < analyserBufRef.current.length; i += 1) {
          const x = analyserBufRef.current[i];
          sumSq += x * x;
        }
        const rms = Math.sqrt(sumSq / analyserBufRef.current.length);
        // Convert to dBFS-ish and normalize (-60..0 dB => 0..1)
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;
        const norm = clamp01((Math.max(-60, Math.min(0, db)) + 60) / 60);

        volumeSumRef.current += norm;
        volumeSamplesRef.current += 1;
        if (norm > volumePeakRef.current) volumePeakRef.current = norm;

        const now = performance.now();
        if (now - lastVolumeUiUpdateRef.current > 150) {
          lastVolumeUiUpdateRef.current = now;
          setCurrentVolumeNorm(norm);
        }

        volumeRafRef.current = requestAnimationFrame(tick);
      };

      volumeRafRef.current = requestAnimationFrame(tick);
    } catch {
      // permission denied / no device: ignore
    }
  };

  const rounds = useMemo(() => {
    const result: Array<{ question?: string; answers: Array<{ kind: 'self' | 'other'; text: string; speaker?: string }> }> = [];
    qaHistory.forEach((item) => {
      if (item.kind === 'system') {
        result.push({ question: item.text, answers: [] });
        return;
      }
      if (!result.length) {
        result.push({ question: undefined, answers: [] });
      }
      result[result.length - 1].answers.push({
        kind: item.kind === 'self' ? 'self' : 'other',
        text: item.text,
        speaker: item.speaker,
      });
    });
    return result;
  }, [qaHistory]);

  const visibleRounds = useMemo(() => rounds.filter((r) => r.answers.length > 0), [rounds]);
  const MIN_ROUNDS_FOR_EVAL = 7;
  const selfAnsweredRounds = useMemo(() => {
    // Count rounds where the current user actually answered (system question + following self).
    let count = 0;
    for (let i = 0; i < qaHistory.length; i++) {
      const item = qaHistory[i];
      if (item.kind !== 'system') continue;
      for (let j = i + 1; j < qaHistory.length; j++) {
        const nextItem = qaHistory[j];
        if (nextItem.kind === 'system') break;
        if (nextItem.kind === 'self') {
          count += 1;
          break;
        }
      }
    }
    return count;
  }, [qaHistory]);
  const canViewResult = selfAnsweredRounds >= MIN_ROUNDS_FOR_EVAL;

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    historyEndRef.current?.scrollIntoView({ block: 'end' });
  }, [qaHistory.length, currentQuestion]);

  const roomId = id ? `practice-${id}` : 'practice';
  // Keep a stable ID for the whole page lifetime (auth store may hydrate later).
  // IMPORTANT: Use sessionStorage (tab-scoped) instead of localStorage to avoid two tabs
  // getting the same guest user_id and kicking each other off the WebSocket room.
  const initialGuestId = (() => {
    const mk = () => {
      // Prefer crypto UUID when available.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c: any = (typeof window !== 'undefined' ? (window as any).crypto : undefined);
        if (c?.randomUUID) return `guest-${c.randomUUID()}`;
      } catch {
        // ignore
      }
      return `guest-${Math.random().toString(36).slice(2, 10)}`;
    };
    if (typeof window !== 'undefined') {
      try {
        const saved = window.sessionStorage.getItem('cf_guest_id');
        if (saved) return saved;
        const fresh = mk();
        window.sessionStorage.setItem('cf_guest_id', fresh);
        return fresh;
      } catch {
        // sessionStorage unavailable (privacy mode) -> fallback to in-memory
        return mk();
      }
    }
    return mk();
  })();
  const guestIdRef = useRef<string>(initialGuestId);

  // Clear guest ID from sessionStorage when user logs in, regenerate when logs out
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authUser?.id) {
      // User logged in: clear guest ID from sessionStorage
      try {
        window.sessionStorage.removeItem('cf_guest_id');
      } catch {
        // ignore
      }
    } else {
      // User logged out: ensure guest ID exists in sessionStorage
      try {
        const saved = window.sessionStorage.getItem('cf_guest_id');
        if (!saved) {
          const fresh = `guest-${Math.random().toString(36).slice(2, 10)}`;
          window.sessionStorage.setItem('cf_guest_id', fresh);
          guestIdRef.current = fresh;
        } else {
          guestIdRef.current = saved;
        }
      } catch {
        // ignore
      }
    }
  }, [authUser?.id]);

  const userId = authUser?.id ?? guestIdRef.current;
  const displayName = authUser?.user_metadata?.full_name || authUser?.email || 'Guest';
  const role = authUser?.user_metadata?.role === 'host' ? 'host' : 'participant';
  const isInQueue = speakQueue.includes(userId);
  const isActiveSpeaker = activeSpeaker === userId;
  const activeSpeakerRole = useMemo(() => {
    if (!activeSpeaker) return null;
    return participants.find((p) => p.user_id === activeSpeaker)?.role || null;
  }, [participants, activeSpeaker]);
  const isHostSpeaking = activeSpeakerRole === 'host';

  // 计算真实用户数量（排除host）
  const realUsers = useMemo(() => {
    return participants.filter(p => p.role !== 'host');
  }, [participants]);
  const isSingleUser = realUsers.length <= 1;
  // Treat host/AI as not blocking the "raise hand" control once question playback ends.
  const otherUserSpeaking = Boolean(activeSpeaker && activeSpeaker !== userId && !isHostSpeaking);

  // 按钮可用性逻辑：
  // 1. 单用户：AI播报完成后就可以举手（不检查activeSpeaker，因为回答完成后会被清除）
  // 2. 多用户：AI播报完成后可用（如果其他用户在回答，按钮会显示"其他用户回答中"并禁用）
  const canToggleHand = !isQuestionPlaying && (!activeSpeaker || isActiveSpeaker || isHostSpeaking);

  const participantMap = useMemo(() => {
    return new Map(participants.map((p) => [p.user_id, p.display_name]));
  }, [participants]);
  const queueDisplay = speakQueue
    .map((pid) => participantMap.get(pid) || pid)
    .join(', ');

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Discussion countdown (whole session)
  useEffect(() => {
    if (!isDiscussionMode) return;
    if (!discussionDeadlineAt) return;
    const tick = () => {
      const nowSec = Date.now() / 1000;
      const left = Math.max(0, Math.ceil(discussionDeadlineAt - nowSec));
      setDiscussionTimeLeftSec(left);
    };
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [isDiscussionMode, discussionDeadlineAt]);

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const hasDoc = searchParams.get('doc') === '1';
    setQuestionHint(hasDoc ? '' : t('session.sample_hint'));
  }, [t, searchParams]);

  const clearVoicesChangedHandler = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const handler = voicesChangedHandlerRef.current;
    if (!handler) return;
    synth.removeEventListener?.('voiceschanged', handler as EventListener);
    // @ts-ignore (older browsers may still use onvoiceschanged)
    if ((synth as any).onvoiceschanged === handler) (synth as any).onvoiceschanged = null;
    voicesChangedHandlerRef.current = null;
  };

  const stopCurrentPlayback = () => {
    if (scheduledAudioStartRef.current) {
      clearTimeout(scheduledAudioStartRef.current);
      scheduledAudioStartRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (questionPlayingWatchdogRef.current) {
      clearTimeout(questionPlayingWatchdogRef.current);
      questionPlayingWatchdogRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      clearVoicesChangedHandler();
      window.speechSynthesis.cancel();
    }
  };

  const scheduleSyncedAudio = (audioUrl: string | null, startAt: number = 0, serverTime?: number) => {
    if (!audioUrl) {
      setIsQuestionPlaying(false);
      return;
    }
    const now = Date.now();
    const serverMs = serverTime ? serverTime * 1000 : now;
    const offsetMs = now - serverMs;
    const targetMs = startAt * 1000 + offsetMs;
    const delayMs = Math.max(0, targetMs - now);

    try {
      stopCurrentPlayback();
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      setIsQuestionPlaying(true);
      audio.onended = () => {
        setIsQuestionPlaying(false);
        if (questionPlayingWatchdogRef.current) {
          clearTimeout(questionPlayingWatchdogRef.current);
          questionPlayingWatchdogRef.current = null;
        }
      };
      audio.onerror = () => {
        setIsQuestionPlaying(false);
        if (questionPlayingWatchdogRef.current) {
          clearTimeout(questionPlayingWatchdogRef.current);
          questionPlayingWatchdogRef.current = null;
        }
      };
      audioRef.current = audio;
      scheduledAudioStartRef.current = setTimeout(() => {
        scheduledAudioStartRef.current = null;
        audio.play().catch(() => {
          // Autoplay blocked / user gesture missing -> don't keep UI in "playing" state.
          setIsQuestionPlaying(false);
        });
      }, delayMs);
      // Safety: if playback never starts/ends, don't block the raise-hand button forever.
      questionPlayingWatchdogRef.current = setTimeout(() => {
        setIsQuestionPlaying(false);
        questionPlayingWatchdogRef.current = null;
      }, 45_000);
    } catch {
      // ignore playback errors
      setIsQuestionPlaying(false);
    }
  };

  const resolveTtsLang = (preferredLanguage?: string | null) => {
    return toSpeechLangTag(normalizeSessionLanguage(preferredLanguage || sessionLanguage));
  };

  const speakWithBrowserTts = (text: string, language?: string | null, onDone?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    try {
      const synth = window.speechSynthesis;
      const lang = resolveTtsLang(language);
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;

      const pickVoice = () => {
        const voices = synth.getVoices?.() || [];
        const langPrefix = lang.split('-')[0]?.toLowerCase() || '';
        const exact = voices.find((v) => (v.lang || '').toLowerCase() === lang.toLowerCase());
        const prefix = voices.find((v) => (v.lang || '').toLowerCase().startsWith(langPrefix));
        return exact || prefix || null;
      };

      const voice = pickVoice();
      if (voice) {
        utter.voice = voice;
      }

      utter.onend = () => onDone?.();
      utter.onerror = () => onDone?.();

      clearVoicesChangedHandler();
      synth.cancel();
      // If voices are not loaded yet, wait for voiceschanged then speak once.
      const voicesNow = synth.getVoices?.() || [];
      if (!voicesNow.length && !voice) {
        const handler = () => {
          try {
            const v = pickVoice();
            if (v) utter.voice = v;
            synth.speak(utter);
          } finally {
            synth.removeEventListener?.('voiceschanged', handler as any);
            // @ts-ignore (some browsers use onvoiceschanged)
            if ((synth as any).onvoiceschanged === handler) (synth as any).onvoiceschanged = null;
            voicesChangedHandlerRef.current = null;
          }
        };
        voicesChangedHandlerRef.current = handler;
        synth.addEventListener?.('voiceschanged', handler as any);
        // @ts-ignore
        if (!(synth as any).addEventListener) (synth as any).onvoiceschanged = handler;
        return true;
      }

      synth.speak(utter);
      return true;
    } catch {
      onDone?.();
      return false;
    }
  };

  const playAiPayload = async (
    rawPayload: any,
    options: { skipHistory?: boolean } = {},
  ) => {
    const text = (rawPayload?.text || rawPayload?.question || '').toString().trim();
    const kind = (rawPayload?.kind || 'question').toString();
    const speakerName = rawPayload?.speaker?.display_name;
    const audioUrl = rawPayload?.audio_url || null;
    const audioBase64 = rawPayload?.audio_base64 || null;
    const audioMime = (rawPayload?.audio_mime || 'audio/mpeg').toString();
    const playbackLanguage = normalizeSessionLanguage(rawPayload?.language || sessionLanguage);
    const audioFingerprint = audioUrl || (audioBase64 ? `${audioMime}:${String(audioBase64).slice(0, 32)}` : null);
    const speakKey = JSON.stringify({
      text,
      kind,
      speakerName,
      audioFingerprint,
      startAt: rawPayload?.start_at || null,
      serverTime: rawPayload?.server_time || null,
      language: playbackLanguage,
    });
    if (lastAiSpeakKeyRef.current === speakKey) {
      return;
    }
    lastAiSpeakKeyRef.current = speakKey;

    if (text) {
      if (lastSpokenQuestionRef.current !== text) {
        spokenUsersRef.current.clear();
      }
      setCurrentQuestion(text);
      setQuestionHint('');
      if (!options.skipHistory) {
        if (isDiscussionMode && kind === 'reply') {
          setQaHistory((prev) => {
            const nextItem = { kind: 'other' as const, text, speaker: speakerName || 'AI' };
            const last = prev.length ? prev[prev.length - 1] : null;
            if (
              last &&
              last.kind === nextItem.kind &&
              last.text === nextItem.text &&
              (last.speaker || 'AI') === nextItem.speaker
            ) {
              return prev;
            }
            return [...prev, nextItem];
          });
        } else {
          setQaHistory((prev) => {
            const nextItem = { kind: 'system' as const, text };
            const last = prev.length ? prev[prev.length - 1] : null;
            if (last && last.kind === nextItem.kind && last.text === nextItem.text) {
              return prev;
            }
            return [...prev, nextItem];
          });
        }
      }
      lastSpokenQuestionRef.current = text;
    }

    if (audioUrl) {
      scheduleSyncedAudio(audioUrl, rawPayload?.start_at || 0, rawPayload?.server_time);
      return;
    }

    if (audioBase64) {
      try {
        const bin = Uint8Array.from(atob(String(audioBase64)), (c) => c.charCodeAt(0));
        const blob = new Blob([bin], { type: audioMime });
        const objectUrl = URL.createObjectURL(blob);
        scheduleSyncedAudio(objectUrl, rawPayload?.start_at || 0, rawPayload?.server_time);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      } catch {
        // Fall through to preview/browser TTS.
      }
    }

    if (!text) {
      setIsQuestionPlaying(false);
      return;
    }

    const presetId = rawPayload?.voice?.preset_id
      ? String(rawPayload.voice.preset_id)
      : '';
    const cacheKey = `${playbackLanguage}::${presetId}::${text}`;
    const cached = ttsUrlCacheRef.current.get(cacheKey);
    if (cached) {
      scheduleSyncedAudio(cached, 0);
      return;
    }

    try {
      const apiBase = resolveApiBase();
      const res = await fetch(`${apiBase}/realtime/tts/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice_preset_id: presetId || null,
          language: playbackLanguage,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const url = data?.audio_url as string | undefined;
        const b64 = data?.audio_base64 as string | undefined;
        const mime = (data?.audio_mime as string | undefined) || 'audio/mpeg';
        if (url) {
          ttsUrlCacheRef.current.set(cacheKey, url);
          scheduleSyncedAudio(url, 0);
          return;
        }
        if (b64) {
          const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const blob = new Blob([bin], { type: mime });
          const objectUrl = URL.createObjectURL(blob);
          scheduleSyncedAudio(objectUrl, 0);
          setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
          return;
        }
      }
    } catch {
      // Fall through to browser TTS.
    }

    setIsQuestionPlaying(true);
    const started = speakWithBrowserTts(text, playbackLanguage, () => setIsQuestionPlaying(false));
    if (!started) {
      setIsQuestionPlaying(false);
    }
  };

  useEffect(() => {
    // Keep browser SpeechRecognition for live transcript (optional).
    // Final transcript can still come from backend Whisper ASR.
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = toSpeechLangTag(sessionLanguage);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onerror = (event: any) => {
      console.warn('[SpeechRecognition] error:', event?.error || event);
    };
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          const finalText = text.trim();
          if (finalText) {
            setTranscript((prev) => [...prev, finalText]);
            currentAnswerRef.current.push(finalText);
          }
        } else {
          interim += text;
        }
      }
      setInterimTranscript(interim.trim());
    };
    recognition.onend = () => {
      if (isRecognizingRef.current) {
        try {
          recognition.start();
        } catch {
          // ignore restart errors
        }
      }
    };
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [sessionLanguage]);

  const startBackendAsrRecording = async () => {
    if (typeof window === 'undefined') return;
    if (!('MediaRecorder' in window)) return;
    // Reset
    recordChunksRef.current = [];
    try {
      let stream: MediaStream | null = null;
      if (localStream?.getAudioTracks?.().length) {
        stream = localStream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!stream?.getAudioTracks?.().length) return;
      recordStreamRef.current = stream;

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      const mimeType = candidates.find((m) => {
        try {
          return (window as any).MediaRecorder?.isTypeSupported?.(m);
        } catch {
          return false;
        }
      });
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      rec.start(500);
    } catch {
      // ignore
    }
  };

  const syncHistoryVideoUrls = async () => {
    if (!authSession?.access_token) return;
    if (!historyPersistedRef.current) return;
    const urls = uploadedVideoUrlsRef.current;
    if (!urls.length) return;
    if (syncedVideoCountRef.current === urls.length) return;
    try {
      const apiBase = resolveApiBase();
      await fetch(`${apiBase}/evaluations/history/video-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          session_id: historySessionIdRef.current,
          video_urls: urls,
          visual_enabled: urls.length > 0,
        }),
      });
      syncedVideoCountRef.current = urls.length;
    } catch {
      // best-effort only, do not impact result flow
    }
  };

  const uploadVideoSegmentToSupabase = async (blob: Blob, segmentIndex: number) => {
    if (!authSession?.access_token) return;
    if (!authUser?.id) return;
    try {
      const supabase = getSupabaseClient();
      const ext = (blob.type || 'video/webm').includes('mp4') ? 'mp4' : 'webm';
      const path = `${authUser.id}/${historySessionIdRef.current}/segment-${String(segmentIndex).padStart(3, '0')}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('interview-videos')
        .upload(path, blob, {
          contentType: blob.type || (ext === 'mp4' ? 'video/mp4' : 'video/webm'),
          upsert: true,
        });
      if (uploadError) return;
      const publicResult = supabase.storage.from('interview-videos').getPublicUrl(path);
      const publicUrl = publicResult?.data?.publicUrl;
      if (!publicUrl) return;
      if (!uploadedVideoUrlsRef.current.includes(publicUrl)) {
        uploadedVideoUrlsRef.current.push(publicUrl);
      }
      void syncHistoryVideoUrls();
    } catch {
      // best-effort only
    }
  };

  const startVideoSegmentRecording = () => {
    if (typeof window === 'undefined') return;
    if (!('MediaRecorder' in window)) return;
    if (isVideoOff) return;
    const stream = localStream;
    if (!stream?.getVideoTracks?.().length) return;
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') return;
    try {
      videoChunksRef.current = [];
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const mimeType = candidates.find((m) => {
        try {
          return (window as any).MediaRecorder?.isTypeSupported?.(m);
        } catch {
          return false;
        }
      });
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      videoRecorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };
      rec.start(1000);
    } catch {
      // ignore video recorder start failure
    }
  };

  const stopVideoSegmentRecordingAndUpload = async () => {
    const rec = videoRecorderRef.current;
    videoRecorderRef.current = null;
    if (!rec) return;
    const segmentIndex = nextVideoSegmentRef.current;
    nextVideoSegmentRef.current += 1;

    await new Promise<void>((resolve) => {
      if (rec.state === 'inactive') return resolve();
      rec.onstop = () => resolve();
      try {
        rec.stop();
      } catch {
        resolve();
      }
    });

    const chunks = videoChunksRef.current;
    videoChunksRef.current = [];
    if (!chunks.length) return;
    const mime = rec.mimeType || (chunks[0] as any)?.type || 'video/webm';
    const blob = new Blob(chunks, { type: mime });
    void uploadVideoSegmentToSupabase(blob, segmentIndex);
  };

  const stopBackendAsrRecordingAndTranscribe = async (): Promise<string> => {
    if (typeof window === 'undefined') return '';
    const rec = recorderRef.current;
    const stream = recordStreamRef.current;
    recorderRef.current = null;
    recordStreamRef.current = null;

    const stopRec = () =>
      new Promise<void>((resolve) => {
        if (!rec) return resolve();
        if (rec.state === 'inactive') return resolve();
        const done = () => resolve();
        rec.onstop = done;
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });

    await stopRec();
    try {
      // If we created a separate mic-only stream, stop it. If it's localStream, leave it.
      if (stream && stream !== localStream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      // ignore
    }

    const parts = recordChunksRef.current;
    recordChunksRef.current = [];
    if (!parts.length) return '';
    const blob = new Blob(parts, { type: (parts[0] as any)?.type || 'audio/webm' });

    try {
      const apiBase = resolveApiBase();
      const fd = new FormData();
      fd.append('audio_file', blob, 'answer.webm');
      const res = await fetch(`${apiBase}/speech/transcribe?language=${encodeURIComponent(sessionLanguage)}`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) return '';
      const data = await res.json();
      const text = (data?.transcript || '').toString().trim();
      return text;
    } catch {
      return '';
    }
  };

  const handleStart = async () => {
    if (!isActiveSpeaker) return;
    setIsRecording(true);
    setIsTranscribing(false);
    setDuration(0);
    setTranscript([]);
    setInterimTranscript('');
    currentAnswerRef.current = [];
    answerStartAtRef.current = performance.now();
    startVolumeMonitoring();
    wsRef.current?.send(JSON.stringify({ type: "start_speak" }));
    startBackendAsrRecording();
    startVideoSegmentRecording();
    if (recognitionRef.current && !isRecognizingRef.current) {
      try {
        setInterimTranscript('');
        recognitionRef.current.start();
        isRecognizingRef.current = true;
      } catch {
        // ignore ASR start errors
      }
    }
  };

  const handleStop = async () => {
    setIsRecording(false);
    setIsTranscribing(true);
    spokenUsersRef.current.add(userId);
    const startedAt = answerStartAtRef.current;
    const durationSec = startedAt ? Math.max(0, (performance.now() - startedAt) / 1000) : Math.max(0, duration);
    answerStartAtRef.current = null;
    stopVolumeMonitoring();
    // Stop browser ASR (if any) and keep it as fallback
    if (recognitionRef.current && isRecognizingRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore ASR stop errors
      }
      isRecognizingRef.current = false;
      if (interimTranscript.trim()) {
        const lastChunk = interimTranscript.trim();
        setTranscript((prev) => [...prev, lastChunk]);
        currentAnswerRef.current.push(lastChunk);
        setInterimTranscript('');
      }
    }
    const browserFallbackText = [
      ...currentAnswerRef.current,
      ...(interimTranscript.trim() ? [interimTranscript.trim()] : [])
    ].join(' ').trim();

    // Prefer backend Whisper ASR, fallback to browser transcript if backend fails/empty
    let answerText = await stopBackendAsrRecordingAndTranscribe();
    void stopVideoSegmentRecordingAndUpload();
    if (!answerText) answerText = browserFallbackText;

    // Reflect UI transcript as a single final chunk (best effort)
    setTranscript(answerText ? [answerText] : []);
    setInterimTranscript('');

    const wordCount = countWords(answerText);
    const wpm = durationSec > 2 && wordCount > 0 ? Math.round(wordCount / (durationSec / 60)) : null;
    const avgVol = volumeSamplesRef.current > 0 ? volumeSumRef.current / volumeSamplesRef.current : null;
    const peakVol = volumeSamplesRef.current > 0 ? volumePeakRef.current : null;
    setAnswerMetrics((prev) => [
      ...prev,
      {
        timestamp: Date.now(),
        durationSec,
        wordCount,
        wpm,
        avgVolumeNorm: avgVol,
        peakVolumeNorm: peakVol,
      },
    ]);
    // Always record a bubble (even for empty answers)
    setQaHistory((prev) => [...prev, { kind: 'self', text: answerText || '' }]);
    wsRef.current?.send(JSON.stringify({
      type: "stop_speak",
      payload: {
        reason: "completed",
        user_id: userId,
        answer_text: answerText,  // 使用处理后的完整文本
        visual_enabled: !isVideoOff,
      }
    }));
    setIsTranscribing(false);
  };

  useEffect(() => {
    return () => {
      stopCurrentPlayback();
      stopVolumeMonitoring();
      try {
        if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
          videoRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      try {
        if (volumeStreamOwnedRef.current) {
          volumeStreamRef.current?.getTracks?.().forEach((t) => t.stop());
        }
      } catch {
        // ignore
      }
      try {
        audioCtxRef.current?.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
      volumeStreamRef.current = null;
      volumeStreamOwnedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectWs = () => {
    if (!id) return;
    if (wsRef.current && wsRef.current.readyState <= 1) return;

    const apiBase = getApiBaseUrl();
    const wsBase = (getWsBaseUrl() || apiBase)
      .replace(/^http/, 'ws')
      .replace(/\/api\/v1\/?$/, '');

    if (!wsBase) return;

    const wsUrl = `${wsBase}/api/v1/realtime/ws/rooms/${roomId}?user_id=${encodeURIComponent(userId)}&display_name=${encodeURIComponent(displayName)}&role=${role}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;
        if (type === "room_state") {
          const newParticipants = payload.participants || [];
          setParticipants(newParticipants);
          setActiveSpeaker(payload.active_speaker || null);
          setSpeakQueue(payload.speak_queue || []);

          if (isDiscussionMode) {
            const d = payload?.discussion || {};
            const deadline = typeof d.deadline_at === 'number' ? d.deadline_at : null;
            if (deadline) setDiscussionDeadlineAt(deadline);
            setDiscussionResultReady(Boolean(d.result_ready));
            setDiscussionPhase(d?.phase != null ? String(d.phase) : null);
            const roles = Array.isArray(d.roles) ? d.roles : [];
            setDiscussionRoles(
              roles
                .map((r: any) => ({
                  role_id: String(r?.role_id || r?.id || ''),
                  name: String(r?.name || 'AI'),
                  avatar: r?.avatar != null ? String(r.avatar) : null,
                }))
                .filter((x: any) => Boolean(x.role_id))
            );
          }

          // Auto-start WebRTC if not started yet
          if (!localStream && newParticipants.length > 0) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
              .then((stream) => {
                setLocalStream(stream);
                setIsMuted(false);
                setIsVideoOff(false);
                // Establish connections with existing participants
                const peers = newParticipants.filter((p: any) => p.user_id !== userId);
                peers.forEach((peer: any) => {
                  enqueueSignaling(peer.user_id, async () => {
                    const pc = ensurePeerConnection(peer.user_id);
                    addLocalTracksOnce(pc, stream);
                    if (pc.signalingState !== "stable") return;
                    makingOfferRef.current[peer.user_id] = true;
                    await pc.setLocalDescription(await pc.createOffer());
                    makingOfferRef.current[peer.user_id] = false;
                    wsRef.current?.send(JSON.stringify({
                      type: "webrtc_offer",
                      payload: { to: peer.user_id, sdp: pc.localDescription }
                    }));
                  }).catch(() => { });
                });
              })
              .catch((err) => {
                // No mic/camera (or permission denied) — keep going in recv-only mode.
                console.warn('getUserMedia unavailable, falling back to recv-only:', err?.name || err);
                const peers = newParticipants.filter((p: any) => p.user_id !== userId);
                peers.forEach((peer: any) => {
                  enqueueSignaling(peer.user_id, async () => {
                    const pc = ensurePeerConnection(peer.user_id);
                    if (pc.signalingState !== "stable") return;
                    makingOfferRef.current[peer.user_id] = true;
                    await pc.setLocalDescription(
                      await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true } as any)
                    );
                    makingOfferRef.current[peer.user_id] = false;
                    wsRef.current?.send(JSON.stringify({
                      type: "webrtc_offer",
                      payload: { to: peer.user_id, sdp: pc.localDescription }
                    }));
                  }).catch(() => { });
                });
              });
          }
          if (payload?.conversation && Array.isArray(payload.conversation)) {
            const mapped: Array<{ kind: 'system' | 'self' | 'other'; text: string; speaker?: string }> = [];
            for (const item of payload.conversation) {
              const role = item?.role;
              const content = (item?.content || '').toString();
              if (!content) continue;
              if (role === 'system') mapped.push({ kind: 'system', text: content });
              if (role === 'user') {
                const msgUserId = item?.user_id != null ? String(item.user_id) : null;
                const msgDisplayName = item?.display_name != null ? String(item.display_name) : undefined;
                const isSelfMsg = msgUserId ? msgUserId === userId : true; // backward compatible
                mapped.push({
                  kind: isSelfMsg ? 'self' : 'other',
                  text: content,
                  speaker: isSelfMsg ? undefined : (msgDisplayName || msgUserId || undefined),
                });
              }
              if (role === 'assistant') {
                const aiName = item?.ai_role_name != null ? String(item.ai_role_name) : 'AI';
                mapped.push({ kind: 'other', text: content, speaker: aiName });
              }
            }
            // 只有当conversation有内容时才更新
            // 合并策略：如果后端conversation已经包含了用户回答，使用后端版本；否则保留本地添加的回答
            if (mapped.length > 0) {
              setQaHistory((prev) => {
                // 如果后端conversation已经包含了用户回答，使用后端版本
                const hasUserAnswer = mapped.some((item) => item.kind === 'self');
                if (hasUserAnswer) {
                  return mapped;
                }
                // 否则，合并本地添加的回答（防止出现 Q1,Q2, A1 这种顺序错乱）
                const lastSelf = [...prev].reverse().find((item) => item.kind === 'self');
                if (!lastSelf) return mapped;
                if (mapped.some((item) => item.kind === 'self' && item.text === lastSelf.text)) return mapped;

                const lastSystemPrev = [...prev].reverse().find((x) => x.kind === 'system')?.text || null;
                const lastSystemMapped = [...mapped].reverse().find((x) => x.kind === 'system')?.text || null;

                // If backend already has a newer system question than what user answered,
                // insert the local answer BEFORE that newest system question.
                if (lastSystemPrev && lastSystemMapped && lastSystemMapped !== lastSystemPrev) {
                  const insertAt = [...mapped].reverse().findIndex((x) => x.kind === 'system');
                  if (insertAt >= 0) {
                    const idxFromStart = mapped.length - 1 - insertAt;
                    return [...mapped.slice(0, idxFromStart), lastSelf, ...mapped.slice(idxFromStart)];
                  }
                }
                return [...mapped, lastSelf];
              });
              const lastSystem = [...mapped].reverse().find((x) => x.kind === 'system')?.text;
              if (lastSystem) {
                // New round/question -> allow users to raise hand again for this round.
                if (lastSpokenQuestionRef.current !== lastSystem) {
                  spokenUsersRef.current.clear();
                }
                setCurrentQuestion(lastSystem);
              }
            }
            const replayPayload = payload?.last_ai_speak;
            const replayServerTime = Number(replayPayload?.server_time || 0);
            const replayAgeSec = replayServerTime ? Math.abs(Date.now() / 1000 - replayServerTime) : 0;
            if (replayPayload && (!replayServerTime || replayAgeSec <= 30)) {
              void playAiPayload(replayPayload, { skipHistory: true });
            }
          }
        } else if (type === "generating_question") {
          setIsGeneratingQuestion(true);
        } else if (type === "ai_speak") {
          setIsGeneratingQuestion(false);
          void playAiPayload(payload);
        } else if (type === "session_end") {
          setInterviewEnded(true);
        } else if (type === "user_left") {
          const leftId = payload?.user_id;
          if (leftId) {
            setParticipants((prev) => prev.filter((p) => p.user_id !== leftId));
            setRemoteStreams((prev) => {
              const next = { ...prev };
              delete next[leftId];
              return next;
            });
            try {
              pcsRef.current[leftId]?.close();
            } catch {
              // ignore
            }
            delete pcsRef.current[leftId];
          }
        } else if (type === "user_joined") {
          // Update participant list immediately (so no refresh is needed)
          if (payload?.user_id) {
            setParticipants((prev) => {
              if (prev.some((p) => p.user_id === payload.user_id)) return prev;
              return [
                ...prev,
                {
                  user_id: payload.user_id,
                  display_name: payload.display_name || payload.user_id,
                  role: payload.role || 'participant',
                },
              ];
            });
          }

          // When a new user joins, establish WebRTC connection (recv-only if we have no local stream)
          if (payload?.user_id && payload.user_id !== userId) {
            enqueueSignaling(payload.user_id, async () => {
              const pc = ensurePeerConnection(payload.user_id);
              if (localStream) {
                addLocalTracksOnce(pc, localStream);
              }
              if (pc.signalingState !== "stable") return;
              makingOfferRef.current[payload.user_id] = true;
              await pc.setLocalDescription(
                await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true } as any)
              );
              makingOfferRef.current[payload.user_id] = false;
              wsRef.current?.send(JSON.stringify({
                type: "webrtc_offer",
                payload: { to: payload.user_id, sdp: pc.localDescription }
              }));
            }).catch((e) => console.warn('createOffer failed:', e));
          }
        } else if (type === "chat") {
          setChatMessages((prev) => [...prev, payload]);
          if (payload?.text) {
            setQaHistory((prev) => [
              ...prev,
              { kind: 'other', text: payload.text, speaker: payload.display_name }
            ]);
          }
        } else if (type === "webrtc_offer") {
          handleOffer(payload);
        } else if (type === "webrtc_answer") {
          handleAnswer(payload);
        } else if (type === "webrtc_ice") {
          handleIce(payload);
        }
      } catch {
        // ignore invalid messages
      }
    };
  };

  // Ensure we leave the room on page unload / navigation
  useEffect(() => {
    const leave = () => {
      try {
        wsRef.current?.send(JSON.stringify({ type: "leave" }));
      } catch {
        // ignore
      }
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', leave);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('beforeunload', leave);
      window.removeEventListener('pagehide', leave);
    };
  }, []);

  const sendChat = () => {
    if (!chatText.trim()) return;
    wsRef.current?.send(JSON.stringify({ type: "chat", payload: { text: chatText } }));
    setChatText('');
  };

  const reconnectWs = () => {
    setIsReconnecting(true);
    wsRef.current?.close();
    setTimeout(() => {
      connectWs();
      setIsReconnecting(false);
    }, 500);
  };

  const toggleHand = () => {
    if (isInQueue || isActiveSpeaker) {
      wsRef.current?.send(JSON.stringify({
        type: "stop_speak",
        payload: { reason: "cancel", user_id: userId }
      }));
      return;
    }
    wsRef.current?.send(JSON.stringify({
      type: "request_speak",
      payload: {
        user_id: userId,
        requested_at: Date.now(),
        has_spoken: spokenUsersRef.current.has(userId),
      }
    }));
  };

  const resolveApiBase = () => {
    const base = getApiBaseUrl();
    if (!base) return '/api/v1';
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  };

  const handleViewEvaluation = async () => {
    if (!isDiscussionMode) {
      if (selfAnsweredRounds < MIN_ROUNDS_FOR_EVAL) {
        alert(t('session.min_rounds_required', { min: MIN_ROUNDS_FOR_EVAL }));
        return;
      }
    }
    // Collect current user's questions and answers only (exclude other users' answers)
    const interviewData: Array<{ role: string; content: string; timestamp: number }> = [];

    if (isDiscussionMode) {
      // Single-round: first system (topic) + first self answer
      const sysIdx = qaHistory.findIndex((x) => x.kind === 'system');
      const selfIdx = sysIdx >= 0 ? qaHistory.findIndex((x, i) => i > sysIdx && x.kind === 'self') : -1;
      if (sysIdx >= 0 && selfIdx >= 0) {
        interviewData.push({ role: 'system', content: qaHistory[sysIdx].text, timestamp: Date.now() - 2000 });
        interviewData.push({ role: 'user', content: qaHistory[selfIdx].text, timestamp: Date.now() - 1000 });
      }
    } else {
      // Group by rounds: find each system question and its following self answer
      for (let i = 0; i < qaHistory.length; i++) {
        const item = qaHistory[i];
        if (item.kind === 'system') {
          // Find the next self answer (current user's answer) for this question
          for (let j = i + 1; j < qaHistory.length; j++) {
            const nextItem = qaHistory[j];
            if (nextItem.kind === 'system') {
              // Next question found, stop searching
              break;
            }
            if (nextItem.kind === 'self') {
              // Found current user's answer
              interviewData.push({
                role: 'system',
                content: item.text,
                timestamp: Date.now() - (qaHistory.length - i) * 1000,
              });
              interviewData.push({
                role: 'user',
                content: nextItem.text,
                timestamp: Date.now() - (qaHistory.length - j) * 1000,
              });
              break;
            }
          }
        }
      }
    }

    if (interviewData.length === 0) {
      alert(t('session.no_qa_data'));
      return;
    }

    setIsEvaluating(true);
    try {
      const apiBase = resolveApiBase();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication token if user is logged in
      if (authSession?.access_token) {
        headers.Authorization = `Bearer ${authSession.access_token}`;
      }

      const response = await fetch(`${apiBase}/evaluations/fast-eval`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          interview: interviewData,
          position: '候选人', // Default position, can be customized later
          topic: searchParams.get('topic') || undefined,
          language: sessionLanguage,
          save_history: Boolean(authSession?.access_token),
          history_context: authSession?.access_token ? {
            session_id: historySessionIdRef.current,
            mode: isDiscussionMode ? 'discussion' : 'practice',
            interview_type: isDiscussionMode
              ? 'discussion'
              : (searchParams.get('doc') === '1' ? 'document' : 'topic'),
            practice_category: searchParams.get('scenario') || undefined,
            position: searchParams.get('topic')
              || (isDiscussionMode
                ? 'Discussion Practice'
                : (searchParams.get('doc') === '1' ? 'Document Practice' : 'Topic Practice')),
            started_at: historyStartedAtRef.current,
            completed_at: new Date().toISOString(),
            video_urls: uploadedVideoUrlsRef.current,
            visual_enabled: uploadedVideoUrlsRef.current.length > 0,
          } : undefined,
          // Lightweight nonverbal metrics (same processing style as frontend UI)
          speech_metrics: (() => {
            const wpmVals = answerMetrics.map((m) => m.wpm).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
            const avgVolVals = answerMetrics.map((m) => m.avgVolumeNorm).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
            const peakVolVals = answerMetrics.map((m) => m.peakVolumeNorm).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
            const avg_wpm = wpmVals.length ? wpmVals.reduce((a, b) => a + b, 0) / wpmVals.length : null;
            const avg_volume_norm = avgVolVals.length ? avgVolVals.reduce((a, b) => a + b, 0) / avgVolVals.length : null;
            const peak_volume_norm = peakVolVals.length ? Math.max(...peakVolVals) : null;
            return {
              answers_count: answerMetrics.length,
              avg_wpm,
              avg_volume_norm,
              peak_volume_norm,
            };
          })(),
          visual_metrics: {
            visual_enabled: !isVideoOff,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evaluation failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      historyPersistedRef.current = true;
      void syncHistoryVideoUrls();

      // Store evaluation result in localStorage and navigate to result page
      if (typeof window !== 'undefined' && id) {
        const evalKey = `eval_result_${id}_${userId}_${historySessionIdRef.current}`;
        window.localStorage.setItem(evalKey, JSON.stringify({
          ...result,
          interview: interviewData,
          timestamp: Date.now(),
        }));
        router.push(`/practice/${id}/result?eval=${encodeURIComponent(evalKey)}`);
      }
    } catch (err) {
      console.error('Evaluation error:', err);
      alert(t('session.evaluation_error'));
    } finally {
      setIsEvaluating(false);
    }
  };

  const forceSpeaker = (targetId: string) => {
    wsRef.current?.send(JSON.stringify({ type: "force_speaker", payload: { target: targetId } }));
  };

  const ensurePeerConnection = (peerId: string) => {
    if (pcsRef.current[peerId]) {
      return pcsRef.current[peerId];
    }
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(JSON.stringify({
          type: "webrtc_ice",
          payload: { to: peerId, candidate: event.candidate }
        }));
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: stream
      }));
      // Ensure remote audio plays even if video element is not interacted with
      try {
        const existing = remoteAudioElsRef.current[peerId];
        if (!existing) {
          const audio = new Audio();
          audio.autoplay = true;
          (audio as any).playsInline = true;
          audio.srcObject = stream as any;
          remoteAudioElsRef.current[peerId] = audio;
          audio.play().catch(() => { });
        } else {
          existing.srcObject = stream as any;
          existing.play().catch(() => { });
        }
      } catch {
        // ignore
      }
    };

    pcsRef.current[peerId] = pc;
    return pc;
  };

  // WebRTC signaling is very stateful; serialize signaling per-peer to avoid races
  const signalingQueueRef = useRef<Record<string, Promise<void>>>({});
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const ignoreOfferRef = useRef<Record<string, boolean>>({});
  const pendingIceRef = useRef<Record<string, RTCIceCandidateInit[]>>({});

  const isPolitePeer = (peerId: string) => {
    // Deterministic tie-breaker so exactly one side is "polite" (perfect negotiation pattern)
    return userId.localeCompare(peerId) < 0;
  };

  const enqueueSignaling = (peerId: string, task: () => Promise<void>) => {
    const prev = signalingQueueRef.current[peerId] ?? Promise.resolve();
    const next = prev
      .catch(() => {
        // swallow previous signaling errors to keep the queue moving
      })
      .then(task);
    signalingQueueRef.current[peerId] = next.catch(() => { });
    return next;
  };

  const addLocalTracksOnce = (pc: RTCPeerConnection, stream: MediaStream) => {
    for (const track of stream.getTracks()) {
      const alreadyAdded = pc.getSenders().some((s) => s.track?.id === track.id);
      if (!alreadyAdded) pc.addTrack(track, stream);
    }
  };

  const flushPendingIce = async (peerId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current[peerId];
    if (!pending?.length) return;
    pendingIceRef.current[peerId] = [];
    for (const c of pending) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // ignore invalid candidates (can happen during renegotiation)
      }
    }
  };

  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    setIsMuted(false);
    setIsVideoOff(false);

    const peers = participants.filter((p) => p.user_id !== userId);
    for (const peer of peers) {
      const pc = ensurePeerConnection(peer.user_id);
      addLocalTracksOnce(pc, stream);
      if (pc.signalingState !== "stable") continue;
      makingOfferRef.current[peer.user_id] = true;
      await pc.setLocalDescription(await pc.createOffer());
      wsRef.current?.send(JSON.stringify({
        type: "webrtc_offer",
        payload: { to: peer.user_id, sdp: pc.localDescription }
      }));
      makingOfferRef.current[peer.user_id] = false;
    }
  };

  const stopCall = () => {
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    signalingQueueRef.current = {};
    makingOfferRef.current = {};
    ignoreOfferRef.current = {};
    pendingIceRef.current = {};
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setRemoteStreams({});
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff((prev) => !prev);
  };

  const handleOffer = async (payload: any) => {
    const from = payload.from;
    return enqueueSignaling(from, async () => {
      const pc = ensurePeerConnection(from);
      const desc = new RTCSessionDescription(payload.sdp);
      if (desc.type !== "offer") return;

      if (localStream) addLocalTracksOnce(pc, localStream);

      const polite = isPolitePeer(from);
      const offerCollision = makingOfferRef.current[from] || pc.signalingState !== "stable";
      ignoreOfferRef.current[from] = !polite && offerCollision;
      if (ignoreOfferRef.current[from]) return;

      if (offerCollision) {
        await pc.setLocalDescription({ type: "rollback" });
      }

      await pc.setRemoteDescription(desc);
      await flushPendingIce(from, pc);
      await pc.setLocalDescription(await pc.createAnswer());

      wsRef.current?.send(JSON.stringify({
        type: "webrtc_answer",
        payload: { to: from, sdp: pc.localDescription }
      }));
    });
  };

  const handleAnswer = async (payload: any) => {
    const from = payload.from;
    return enqueueSignaling(from, async () => {
      const pc = ensurePeerConnection(from);
      const desc = new RTCSessionDescription(payload.sdp);
      if (desc.type !== "answer") return;
      if (pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(desc);
      await flushPendingIce(from, pc);
    });
  };

  const handleIce = async (payload: any) => {
    const from = payload.from;
    return enqueueSignaling(from, async () => {
      const pc = ensurePeerConnection(from);
      if (!payload.candidate) return;
      if (ignoreOfferRef.current[from]) return;

      // If ICE arrives before SDP is applied, queue it to avoid InvalidStateError
      if (!pc.remoteDescription) {
        pendingIceRef.current[from] = [...(pendingIceRef.current[from] ?? []), payload.candidate];
        return;
      }
      await pc.addIceCandidate(payload.candidate);
    });
  };

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
      stopCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  useEffect(() => {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
    if (isActiveSpeaker && !isRecording) {
      startTimeoutRef.current = setTimeout(() => {
        wsRef.current?.send(JSON.stringify({
          type: "stop_speak",
          payload: { reason: "timeout", user_id: userId }
        }));
      }, 5000);
    }
    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    };
  }, [isActiveSpeaker, isRecording, userId]);

  const avgWpm = useMemo(() => {
    const vals = answerMetrics.map((m) => m.wpm).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [answerMetrics]);

  const avgVolumeNorm = useMemo(() => {
    const vals = answerMetrics.map((m) => m.avgVolumeNorm).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [answerMetrics]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Top Header / Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/80" onClick={() => router.back()}>
            <X className="h-5 w-5 text-gray-500" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('session.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('session.subtitle')} • {id ?? '—'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isRecording ? "bg-red-500" : "bg-gray-300")} />
          <span className="font-mono text-sm font-medium text-gray-700 w-12">
            {isDiscussionMode && discussionTimeLeftSec != null ? formatTime(discussionTimeLeftSec) : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-rows-[auto_auto_1fr] gap-6 max-w-6xl mx-auto w-full">

        {/* 1. Question */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden relative min-h-[200px] flex items-center justify-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

          <CardContent className="relative z-10 text-center space-y-4 p-8 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-indigo-50 text-xs font-medium uppercase tracking-wider backdrop-blur-sm border border-white/10">
              <MessageSquare size={12} />
              {t('session.current_question')}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
              {isGeneratingQuestion ? (
                <span className="inline-flex items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  {t('session.generating_question')}
                </span>
              ) : (
                `"${currentQuestion || t('session.waiting_question')}"`
              )}
            </h2>
            {questionHint ? (
              <p className="text-indigo-100 text-sm sm:text-base max-w-lg mx-auto">
                {questionHint}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* 2. Participants */}
        {isDiscussionMode ? (
          <div className="space-y-4">
            <DiscussionVirtualUsers roles={discussionRoles} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(participants.length ? participants : []).map((p, idx) => {
                const stream = p.user_id === userId ? localStream : remoteStreams[p.user_id];
                return (
                  <Card
                    key={p.user_id}
                    className={cn(
                      "border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden",
                      activeSpeaker === p.user_id && "ring-2 ring-emerald-400"
                    )}
                  >
                    <CardContent className="p-3 flex flex-col gap-2">
                      <div className="w-full aspect-video rounded-md bg-black overflow-hidden">
                        {stream ? (
                          <video
                            className="w-full h-full object-cover"
                            autoPlay
                            playsInline
                            muted={p.user_id === userId}
                            ref={(el) => {
                              if (el) {
                                el.srcObject = stream;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div
                              className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center",
                                idx % 4 === 0
                                  ? "bg-indigo-100 text-indigo-600"
                                  : idx % 4 === 1
                                    ? "bg-pink-100 text-pink-600"
                                    : idx % 4 === 2
                                      ? "bg-emerald-100 text-emerald-600"
                                      : "bg-amber-100 text-amber-600"
                              )}
                            >
                              <User size={28} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-900">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.role}
                          {activeSpeaker === p.user_id ? ` • ${t('session.speaking')}` : ""}
                          {speakQueue.includes(p.user_id) ? ` • ${t('session.in_queue')}` : ""}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden">
              <CardContent className="p-4 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-1 bg-slate-900 text-white">
                  <Bot size={32} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">{t('session.ai')}</p>
                  <p className="text-xs text-muted-foreground">{t('session.interviewer')}</p>
                </div>
              </CardContent>
            </Card>

            {(participants.length
              ? participants
              : [1, 2, 3].map((i) => ({
                user_id: String(i),
                display_name: `${t('session.interviewer')} ${i}`,
                role: "participant"
              }))
            ).map((p, idx) => {
              const stream = p.user_id === userId ? localStream : remoteStreams[p.user_id];
              return (
                <Card
                  key={p.user_id}
                  className={cn(
                    "border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden",
                    activeSpeaker === p.user_id && "ring-2 ring-emerald-400"
                  )}
                >
                  <CardContent className="p-3 flex flex-col gap-2">
                    <div className="w-full aspect-video rounded-md bg-black overflow-hidden">
                      {stream ? (
                        <video
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted={p.user_id === userId}
                          ref={(el) => {
                            if (el) {
                              el.srcObject = stream;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center",
                            idx % 4 === 0 ? "bg-indigo-100 text-indigo-600" :
                              idx % 4 === 1 ? "bg-pink-100 text-pink-600" :
                                idx % 4 === 2 ? "bg-emerald-100 text-emerald-600" :
                                  "bg-amber-100 text-amber-600"
                          )}>
                            <User size={28} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.role}
                        {activeSpeaker === p.user_id ? ` • ${t('session.speaking')}` : ""}
                        {speakQueue.includes(p.user_id) ? ` • ${t('session.in_queue')}` : ""}
                      </p>
                      {role === 'host' && p.user_id !== userId && (
                        <button
                          className="mt-1 text-xs text-indigo-600 hover:underline"
                          onClick={() => forceSpeaker(p.user_id)}
                        >
                          {t('session.force_speaker')}
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 3. Dialogue & Evaluation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[300px]">
          <Card className="lg:col-span-2 border-none shadow-md flex flex-col">
            <CardHeader className="pb-3 border-b bg-gray-50/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4 text-indigo-500" />
                {t('session.live_transcript')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-6 bg-gray-50/30 overflow-y-auto min-h-[200px] flex flex-col">
              <div
                ref={historyScrollRef}
                className="flex-1 overflow-y-auto space-y-3 mb-4"
                onScroll={() => {
                  const el = historyScrollRef.current;
                  if (!el) return;
                  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                  shouldStickToBottomRef.current = atBottom;
                }}
              >
                {qaHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Volume2 size={24} />
                    </div>
                    <p className="text-sm">{t('session.start_speaking_hint')}</p>
                  </div>
                ) : (
                  qaHistory.map((item, idx) => {
                    const isSystem = item.kind === 'system';
                    const isSelf = item.kind === 'self';
                    const label = isSystem
                      ? t('session.question')
                      : isSelf
                        ? t('session.you')
                        : (item.speaker || t('session.other'));

                    return (
                      <div key={`${idx}-${item.kind}`} className={cn("flex", isSelf ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-xl px-3 py-2 border",
                            isSystem
                              ? "bg-indigo-50 border-indigo-100"
                              : isSelf
                                ? "bg-emerald-50 border-emerald-200"
                                : "bg-gray-50 border-gray-200"
                          )}
                        >
                          <div className={cn(
                            "text-[10px] uppercase tracking-wider mb-1",
                            isSystem ? "text-indigo-600" : isSelf ? "text-emerald-600" : "text-gray-500"
                          )}>
                            {label}
                          </div>
                          <div className={cn(
                            "text-sm leading-relaxed whitespace-pre-wrap break-words",
                            isSystem ? "text-gray-900" : isSelf ? "text-gray-800" : "text-gray-700"
                          )}>
                            {item.text || <span className="text-gray-400 italic">（空回复）</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={historyEndRef} />
              </div>

              {/* Replace pinned "current question" in discussion mode */}
              {!isDiscussionMode && currentQuestion && (
                <div className="mt-auto pt-4 border-t border-gray-200 bg-white rounded-lg p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-1">
                    {t('session.current_question')}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {currentQuestion}
                  </div>
                </div>
              )}

              {isDiscussionMode && (discussionPhase === 'AI_DECIDING' || isGeneratingQuestion) ? (
                <div className="mt-auto pt-4 border-t border-gray-200">
                  <div className="w-full flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI 正在思考回答中…
                    </div>
                  </div>
                </div>
              ) : null}

              {interimTranscript && (
                <div className="mt-2 text-gray-400 italic text-sm">
                  {interimTranscript}
                </div>
              )}

              {transcript.length > 0 && (
                <div className="mt-2 text-gray-600 text-sm space-y-1">
                  {transcript.slice(-6).map((line, i) => (
                    <div key={`${i}-${line.slice(0, 12)}`} className="whitespace-pre-wrap break-words">
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {isRecording && (
                <div className="flex gap-1 items-center mt-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                </div>
              )}
            </CardContent>

            <div className="p-4 border-t bg-white flex flex-wrap items-center justify-center gap-3">
              {isActiveSpeaker && (
                !isRecording ? (
                  <Button
                    size="lg"
                    className="rounded-full w-48 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                    onClick={handleStart}
                  >
                    <Play className="h-5 w-5 mr-2 fill-current" />
                    {t('session.start_answer')}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-48 shadow-lg shadow-red-200"
                    onClick={handleStop}
                  >
                    <Square className="h-5 w-5 mr-2 fill-current" />
                    {t('session.finish_answer')}
                  </Button>
                )
              )}

              {isDiscussionMode ? (
                discussionTimeLeftSec != null && discussionTimeLeftSec <= 0 ? (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleViewEvaluation}
                    disabled={isEvaluating || isQuestionPlaying}
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('session.evaluating')}
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        {t('session.view_result')}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={toggleHand}
                    disabled={!canToggleHand || !!otherUserSpeaking}
                  >
                    {isInQueue || isActiveSpeaker
                      ? t('session.lower_hand')
                      : otherUserSpeaking
                        ? t('session.other_user_answering')
                        : t('session.raise_hand')}
                  </Button>
                )
              ) : canViewResult ? (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleViewEvaluation}
                  disabled={isEvaluating}
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('session.evaluating')}
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      {t('session.view_result')}
                    </>
                  )}
                </Button>
              ) : (
                <Button variant="outline" className="gap-2" onClick={toggleHand} disabled={!canToggleHand || !!otherUserSpeaking}>
                  {isInQueue || isActiveSpeaker
                    ? t('session.lower_hand')
                    : otherUserSpeaking
                      ? t('session.other_user_answering')
                      : t('session.raise_hand')}
                </Button>
              )}
              <Button variant="outline" className="gap-2" onClick={reconnectWs} disabled={isReconnecting}>
                {isReconnecting ? t('session.reconnecting') : t('session.reconnect')}
              </Button>
              {id && interviewEnded && (
                <Button variant="ghost" onClick={() => router.push(`/practice/${id}/result`)}>
                  {t('session.view_result')}
                </Button>
              )}
            </div>
          </Card>

          <Card className="border-none shadow-md flex flex-col bg-slate-900 text-white">
            <CardHeader className="pb-3 border-b border-white/10">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <BarChart2 className="h-4 w-4 text-emerald-400" />
                {t('session.realtime_analysis')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{t('session.speaking_pace')}</span>
                  <span className="text-emerald-400 font-medium">
                    {avgWpm ? `${Math.round(avgWpm)} ${t('session.wpm_unit')}` : '—'}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-300"
                    style={{
                      width: avgWpm ? `${Math.max(0, Math.min(100, ((avgWpm - 80) / (200 - 80)) * 100))}%` : '0%',
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-right">
                  {isRecording ? `${Math.round((currentVolumeNorm || 0) * 100)}%` : (avgWpm ? `${Math.round(avgWpm)} ${t('session.wpm_unit')}` : t('session.words_per_min'))}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{t('session.volume_level')}</span>
                  <span className="text-blue-400 font-medium">
                    {avgVolumeNorm != null ? `${Math.round(avgVolumeNorm * 100)}%` : '—'}
                  </span>
                </div>
                <div className="flex gap-1 h-8 items-end justify-between px-2">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const level = isRecording ? (currentVolumeNorm || 0) : (avgVolumeNorm || 0);
                    const wobble = [0.65, 0.9, 0.75, 1.0, 1.15, 0.85, 1.05, 0.8, 0.95, 0.7][i] || 1;
                    const h = Math.round((10 + level * 80) * wobble);
                    return (
                      <div
                        key={i}
                        className="w-1.5 bg-blue-500/50 rounded-sm transition-all duration-300"
                        style={{
                          height: `${Math.max(8, Math.min(95, h))}%`,
                          opacity: isRecording ? 1 : (avgVolumeNorm != null ? 0.7 : 0.3)
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="mt-auto p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-200 mb-1">{t('session.ai_tip')}</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {t('session.ai_tip_message')}
                    </p>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

