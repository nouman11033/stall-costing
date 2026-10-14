'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Mic, MicOff, Square, Play, AlertCircle, Keyboard, Sparkles } from 'lucide-react';

type RecognitionCtor = new () => SpeechRecognition;
type CaptionSource = 'manual' | 'speech' | 'bmt';

type BmtCaption = { start: number; end: number; sentence: string };

function getSpeechRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function LiveWebcamCaptionsClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [camOn, setCamOn] = useState(false);
  const [captionSource, setCaptionSource] = useState<CaptionSource>('manual');
  const [listenOn, setListenOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalLines, setFinalLines] = useState<string[]>([]);
  const [interim, setInterim] = useState('');
  const [manualDraft, setManualDraft] = useState('');
  const [supported, setSupported] = useState<boolean | null>(null);
  const [bmtLoading, setBmtLoading] = useState(false);
  const [bmtResults, setBmtResults] = useState<BmtCaption[]>([]);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not access webcam');
      setCamOn(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListenOn(false);
    setInterim('');
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimPiece = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) {
          const trimmed = text.trim();
          if (trimmed) {
            setFinalLines((prev) => [...prev.slice(-11), trimmed]);
          }
          setInterim('');
        } else {
          interimPiece += text;
        }
      }
      if (interimPiece) setInterim(interimPiece.trim());
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setError('Microphone permission denied for captions.');
      } else if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
        setError(`Speech: ${ev.error}`);
      }
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
        setListenOn(false);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setListenOn(true);
    } catch {
      setError('Could not start speech recognition.');
    }
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
      stopCamera();
    };
  }, [stopCamera, stopListening]);

  useEffect(() => {
    if (captionSource === 'manual' || captionSource === 'bmt') {
      stopListening();
    }
  }, [captionSource, stopListening]);

  const recordBMTClip = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) {
      setError('Start the camera first.');
      return;
    }
    setError(null);
    setBmtLoading(true);
    setBmtResults([]);
    try {
      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });
      rec.start();
      await new Promise((r) => setTimeout(r, 4000));
      rec.stop();
      await stopped;
      const blob = new Blob(chunks, { type: mime?.split(';')[0] || 'video/webm' });
      const fd = new FormData();
      fd.append('video', blob, 'clip.webm');
      const res = await fetch('/api/bmt/caption', { method: 'POST', body: fd });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        captions?: BmtCaption[];
      };
      if (!res.ok || !data.ok) {
        const msg = [data.detail, data.error].filter(Boolean).join(' — ');
        throw new Error(msg || `Server returned ${res.status}`);
      }
      setBmtResults(Array.isArray(data.captions) ? data.captions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBmtLoading(false);
    }
  }, []);

  const displayLines = finalLines.slice(-3);
  const lastLine = displayLines[displayLines.length - 1] ?? '';

  const manualHistory = finalLines.slice(-3);
  const showSpeechBanner = captionSource === 'speech' && supported === false;

  return (
    <div className="min-h-screen bg-[#F9F4EE] text-[#010101] relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(to right, #E5DDD1 1px, transparent 1px),
            linear-gradient(to bottom, #E5DDD1 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#C4B5A0]/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#D4CCC0]/40 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <header className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#010101]/10 bg-white/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#010101]/60 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 text-4xl font-black tracking-tight sm:text-5xl"
          >
            Webcam captions
          </motion.h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#010101]/65">
            <strong>Typed</strong> (no mic), <strong>Speech</strong> (browser), or <strong>BMT</strong> (server: I3D +
            VGGish + your checkpoints). BMT needs <code className="rounded bg-[#010101]/10 px-1">ffmpeg</code>,{' '}
            <code className="rounded bg-[#010101]/10 px-1">BMT_PYTHON</code> pointing at your conda Python, and CUDA
            for feature extraction in most setups.
          </p>
        </header>

        {showSpeechBanner && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950 backdrop-blur-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Speech mode is not supported in this browser. Use <strong>Typed</strong> captions or try the latest{' '}
              <strong>Chrome</strong> or <strong>Edge</strong>.
            </p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 p-4 text-sm text-red-950 backdrop-blur-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 120, damping: 18 }}
          className="overflow-hidden rounded-[28px] border border-white/80 bg-white/40 shadow-[0_24px_80px_-12px_rgba(1,1,1,0.18)] backdrop-blur-xl"
        >
          <div className="relative aspect-video w-full bg-[#0a0a0a]">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-white/80">
                <Camera className="h-12 w-12 opacity-40" />
                <p className="text-sm font-medium">Camera off</p>
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)',
              }}
            />
            <div className="pointer-events-none absolute left-3 top-3 h-8 w-8 border-l-2 border-t-2 border-white/35" />
            <div className="pointer-events-none absolute right-3 top-3 h-8 w-8 border-r-2 border-t-2 border-white/35" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-8 w-8 border-b-2 border-l-2 border-white/25" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-8 w-8 border-b-2 border-r-2 border-white/25" />
          </div>

          <div className="relative border-t border-[#010101]/8 bg-gradient-to-b from-[#FDFBF7] to-[#F3EDE6] px-5 py-6 sm:px-8 sm:py-8">
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-[#C4B5A0] to-transparent opacity-90" />

            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#010101]/45">
                  {captionSource === 'manual' ? (
                    <Keyboard className="h-4 w-4 text-[#010101]/50" />
                  ) : captionSource === 'bmt' ? (
                    <Sparkles className="h-4 w-4 text-amber-700/80" />
                  ) : (
                    <Mic className={`h-4 w-4 ${listenOn ? 'text-emerald-600' : ''}`} />
                  )}
                  Transcript
                </div>
                <div
                  className="inline-flex rounded-xl border border-[#010101]/10 bg-[#010101]/[0.04] p-1"
                  role="tablist"
                  aria-label="Caption source"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={captionSource === 'manual'}
                    onClick={() => {
                      setError(null);
                      setCaptionSource('manual');
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                      captionSource === 'manual'
                        ? 'bg-white text-[#010101] shadow-sm'
                        : 'text-[#010101]/50 hover:text-[#010101]/75'
                    }`}
                  >
                    Typed
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={captionSource === 'speech'}
                    onClick={() => {
                      setError(null);
                      setCaptionSource('speech');
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                      captionSource === 'speech'
                        ? 'bg-white text-[#010101] shadow-sm'
                        : 'text-[#010101]/50 hover:text-[#010101]/75'
                    }`}
                  >
                    Speech
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={captionSource === 'bmt'}
                    onClick={() => {
                      setError(null);
                      setCaptionSource('bmt');
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                      captionSource === 'bmt'
                        ? 'bg-white text-[#010101] shadow-sm'
                        : 'text-[#010101]/50 hover:text-[#010101]/75'
                    }`}
                  >
                    BMT
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!camOn ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#010101] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#222]"
                  >
                    <Camera className="h-4 w-4" />
                    Start camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#010101]/15 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#010101] transition hover:bg-white"
                  >
                    <Square className="h-4 w-4" />
                    Stop camera
                  </button>
                )}
                {captionSource === 'speech' && supported && (
                  <>
                    {!listenOn ? (
                      <button
                        type="button"
                        onClick={startListening}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-800"
                      >
                        <Play className="h-4 w-4" />
                        Start captions
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopListening}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-800/30 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100/80"
                      >
                        <MicOff className="h-4 w-4" />
                        Stop captions
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {captionSource === 'bmt' ? (
              <div className="relative min-h-[180px] space-y-4 rounded-2xl border border-[#010101]/6 bg-[#010101]/[0.03] p-5 sm:min-h-[200px] sm:p-6">
                {bmtLoading && (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <motion.div
                      className="h-10 w-10 rounded-full border-2 border-amber-700/30 border-t-amber-800"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <p className="text-sm font-medium text-[#010101]/70">
                      Running BMT (ffmpeg → I3D + VGGish → proposals + captions)…
                    </p>
                    <p className="max-w-md text-xs text-[#010101]/45">First run can take several minutes while models and features load.</p>
                  </div>
                )}
                {!bmtLoading && bmtResults.length === 0 && (
                  <p className="py-6 text-center text-sm text-[#010101]/45">
                    Record a 4-second clip from the camera. Ensure the Next.js server can run{' '}
                    <code className="rounded bg-[#010101]/10 px-1">BMT/scripts/live_clip_caption.py</code> with{' '}
                    <code className="rounded bg-[#010101]/10 px-1">BMT_PYTHON</code>.
                  </p>
                )}
                {!bmtLoading &&
                  bmtResults.map((c, idx) => (
                    <motion.div
                      key={`${c.start}-${c.end}-${idx}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="rounded-xl border border-[#010101]/8 bg-white/50 px-4 py-3 backdrop-blur-sm"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#010101]/40">
                        {c.start}s – {c.end}s
                      </p>
                      <p className="mt-1 text-base font-semibold leading-snug text-[#010101]">{c.sentence}</p>
                    </motion.div>
                  ))}
              </div>
            ) : (
              <div className="relative min-h-[140px] rounded-2xl border border-[#010101]/6 bg-[#010101]/[0.03] p-5 sm:min-h-[160px] sm:p-6">
                <AnimatePresence mode="popLayout">
                  {(captionSource === 'manual' ? manualHistory.slice(0, -1) : displayLines.slice(0, -1)).map(
                    (line, i) => (
                      <motion.p
                        key={`${captionSource}-${line}-${i}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 0.45, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-2 text-sm leading-relaxed text-[#010101]/55 sm:text-base"
                      >
                        {line}
                      </motion.p>
                    )
                  )}
                </AnimatePresence>

                <motion.div layout className="relative">
                  <motion.p
                    key={
                      captionSource === 'manual'
                        ? `m-${manualDraft}`
                        : `s-${lastLine}${interim}`
                    }
                    initial={{ opacity: 0.5, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.35 }}
                    className="whitespace-pre-wrap text-xl font-semibold leading-snug tracking-tight text-[#010101] sm:text-2xl sm:leading-snug"
                  >
                    {captionSource === 'manual'
                      ? manualDraft || (manualHistory.length ? manualHistory[manualHistory.length - 1] : '')
                      : lastLine}
                    {captionSource === 'speech' && interim && (
                      <span className="text-[#010101]/45"> {interim}</span>
                    )}
                  </motion.p>
                  {captionSource === 'speech' && listenOn && (
                    <motion.div
                      className="mt-4 flex h-1.5 gap-1 overflow-hidden rounded-full bg-[#010101]/10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <motion.span
                          key={i}
                          className="h-full flex-1 rounded-full bg-gradient-to-t from-emerald-700 to-emerald-400"
                          animate={{ scaleY: [0.35, 1, 0.45, 0.9, 0.35] }}
                          transition={{
                            duration: 1.1,
                            repeat: Infinity,
                            delay: i * 0.08,
                            ease: 'easeInOut',
                          }}
                          style={{ transformOrigin: 'bottom' }}
                        />
                      ))}
                    </motion.div>
                  )}
                  {captionSource === 'manual' && manualDraft.length > 0 && (
                    <motion.div
                      className="mt-4 flex h-1.5 gap-1 overflow-hidden rounded-full bg-[#010101]/10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <motion.span
                          key={i}
                          className="h-full flex-1 rounded-full bg-gradient-to-t from-[#5c5346] to-[#A89880]"
                          animate={{ scaleY: [0.4, 0.95, 0.5, 0.85, 0.4] }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.07,
                            ease: 'easeInOut',
                          }}
                          style={{ transformOrigin: 'bottom' }}
                        />
                      ))}
                    </motion.div>
                  )}
                </motion.div>

                {captionSource === 'manual' &&
                  !manualDraft &&
                  manualHistory.length === 0 && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-[#010101]/40">
                      Type in the box below—no microphone. Press Enter to save a line to history.
                    </p>
                  )}
                {captionSource === 'speech' && !listenOn && !lastLine && !interim && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-[#010101]/40">
                    Start speech captions (uses your mic). Camera is optional.
                  </p>
                )}
                {captionSource === 'speech' && listenOn && !lastLine && !interim && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-emerald-800/70">
                    Listening…
                  </p>
                )}
              </div>
            )}

            {captionSource === 'manual' && (
              <div className="mt-5">
                <label htmlFor="manual-captions" className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#010101]/45">
                  Your captions (no mic)
                </label>
                <textarea
                  id="manual-captions"
                  value={manualDraft}
                  onChange={(e) => setManualDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const t = manualDraft.trim();
                      if (t) {
                        setFinalLines((prev) => [...prev.slice(-11), t]);
                        setManualDraft('');
                      }
                    }
                  }}
                  rows={3}
                  placeholder="Type what should appear above… Enter = new line in history. Shift+Enter = line break."
                  className="w-full resize-y rounded-xl border border-[#010101]/12 bg-white/90 px-4 py-3 text-sm leading-relaxed text-[#010101] shadow-inner outline-none ring-0 transition placeholder:text-[#010101]/35 focus:border-[#010101]/25"
                />
              </div>
            )}

            {captionSource === 'bmt' && (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={recordBMTClip}
                  disabled={!camOn || bmtLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-800 to-amber-950 px-4 py-3 text-sm font-semibold text-white shadow-lg transition enabled:hover:from-amber-900 enabled:hover:to-black disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                >
                  <Sparkles className="h-4 w-4" />
                  {bmtLoading ? 'Processing…' : 'Record 4s & run BMT'}
                </button>
                <p className="text-xs leading-relaxed text-[#010101]/50">
                  Put <code className="rounded bg-[#010101]/10 px-1">BMT_PYTHON=/…/conda/envs/…/python</code> in{' '}
                  <code className="rounded bg-[#010101]/10 px-1">.env.local</code> if the server should not auto-pick{' '}
                  <code className="rounded bg-[#010101]/10 px-1">bmt_mps</code>. I3D needs CUDA/CuPy; on Mac set{' '}
                  <code className="rounded bg-[#010101]/10 px-1">BMT_FEATURE_PYTHON</code> to a CUDA env or run
                  extraction on Linux/Colab.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
