"use client";

import { useCallback, useRef, useState } from "react";

export type VoiceRecorderError = "permission-denied" | "no-mic" | "unknown";

interface VoiceRecorderState {
  recording: boolean;
  level: number; // 0-1 amplitude, for a waveform/pulse visualization
}

const MAX_RECORDING_MS = 20_000;
const SILENCE_THRESHOLD = 0.015;
const SILENCE_STOP_MS = 2200;
// Require the signal to stay above the threshold for a short sustained
// stretch before treating it as "the user has started speaking" — a single
// noisy tick (or an analyser reading taken before the audio graph has
// settled) shouldn't be enough to arm the silence-countdown, since doing so
// risks starting the 2.2s silence timer during the natural pause most people
// take between tapping the mic and actually beginning to talk, cutting the
// clip short before any real speech is captured — a failure that looks
// identical at any speaking volume, since it never depended on volume.
const MIN_SPEECH_MS = 250;

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

/**
 * Owns the browser mic: permission request, recording, live amplitude for a
 * waveform/pulse UI, and auto-stop after a short stretch of silence (once
 * the user has actually started speaking) or a hard max-duration cap. Pure
 * audio capture — knows nothing about transcription or parsing; the caller
 * gets a Blob back from `stop()`.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({ recording: false, level: 0 });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const aboveThresholdStartRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopResolveRef = useRef<((blob: Blob) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const monitorLevel = useCallback((onAutoStop: () => void) => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      if (!analyser) return;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      setState((s) => ({ ...s, level: Math.min(1, rms * 4) }));

      const now = performance.now();
      if (rms > SILENCE_THRESHOLD) {
        // Only treat this as "real speech" once the signal has stayed above
        // the threshold for a sustained stretch — see MIN_SPEECH_MS above.
        if (aboveThresholdStartRef.current === null) aboveThresholdStartRef.current = now;
        else if (!hasSpokenRef.current && now - aboveThresholdStartRef.current >= MIN_SPEECH_MS) {
          hasSpokenRef.current = true;
        }
        silenceStartRef.current = null;
      } else {
        aboveThresholdStartRef.current = null;
        if (hasSpokenRef.current) {
          if (silenceStartRef.current === null) silenceStartRef.current = now;
          else if (now - silenceStartRef.current > SILENCE_STOP_MS) {
            onAutoStop();
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob());
        return;
      }
      stopResolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const start = useCallback(async (): Promise<{ ok: true } | { ok: false; error: VoiceRecorderError }> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return { ok: false, error: "no-mic" };
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") return { ok: false, error: "permission-denied" };
      if (name === "NotFoundError") return { ok: false, error: "no-mic" };
      return { ok: false, error: "unknown" };
    }

    streamRef.current = stream;
    hasSpokenRef.current = false;
    silenceStartRef.current = null;
    aboveThresholdStartRef.current = null;
    chunksRef.current = [];

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    // `new AudioContext()` here runs after the `await getUserMedia(...)`
    // above — i.e. outside the synchronous user-gesture call stack — so
    // Chrome/Edge's autoplay policy can start it "suspended". A suspended
    // context freezes the analyser's readings at silence regardless of how
    // loud the mic actually is, which would make the level meter and the
    // silence-based auto-stop both blind to real speech at ANY volume.
    // MediaRecorder itself doesn't depend on this context, so the recording
    // would still contain real audio either way, but the auto-stop/level UI
    // silently breaking is a real bug worth closing off.
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      cleanup();
      setState({ recording: false, level: 0 });
      stopResolveRef.current?.(blob);
      stopResolveRef.current = null;
    };

    recorder.start();
    setState({ recording: true, level: 0 });
    monitorLevel(() => stop());
    maxTimerRef.current = setTimeout(() => stop(), MAX_RECORDING_MS);

    return { ok: true };
  }, [cleanup, monitorLevel, stop]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    stopResolveRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setState({ recording: false, level: 0 });
  }, [cleanup]);

  return { recording: state.recording, level: state.level, start, stop, cancel };
}
