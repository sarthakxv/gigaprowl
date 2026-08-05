"use client";
import { useState, useRef, useEffect, useCallback } from "react";

// A short, natural script so people aren't stuck deciding what to say.
// Reading ~25-30s of this gives the clone plenty of clean phonemes.
const PROMPT =
  "Hey, I'm building my career on my own terms. I'm someone who ships real work, learns fast, and cares about doing things well. When I find a team I believe in, I go all in — and I'd rather reach out directly than wait in a pile of applications. So here's me, in my own voice, ready to get hunted.";

const MAX_MS = 30000;

// Encode Float32 mono samples → 16-bit PCM WAV (downsampled to 16kHz).
// WAV is accepted everywhere; recording straight to webm/opus can be rejected
// by voice-clone APIs, so we normalize here in the browser.
function encodeWav(samples, sampleRate, targetRate = 16000) {
  // downsample
  let data = samples;
  if (sampleRate > targetRate) {
    const ratio = sampleRate / targetRate;
    const outLen = Math.floor(samples.length / ratio);
    data = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) data[i] = samples[Math.floor(i * ratio)];
    sampleRate = targetRate;
  }
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  const w = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  w(0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  w(8, "WAVE"); w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);      // PCM
  view.setUint16(22, 1, true);      // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, data.length * 2, true);
  let off = 44;
  for (let i = 0; i < data.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

export default function VoiceRecorder({ onUpload, done }) {
  const [state, setState] = useState("idle"); // idle | recording | recorded | uploading | error
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);

  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const procRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const rafRef = useRef(null);
  const blobRef = useRef(null);
  const recordingRef = useRef(false);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (procRef.current) { try { procRef.current.disconnect(); } catch {} procRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
  }, []);

  useEffect(() => () => { cleanup(); if (previewUrl) URL.revokeObjectURL(previewUrl); }, [cleanup, previewUrl]);

  const stop = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const sr = ctxRef.current ? ctxRef.current.sampleRate : 48000;
    cleanup();
    const merged = chunksRef.current.length
      ? chunksRef.current.reduce((acc, c) => { const m = new Float32Array(acc.length + c.length); m.set(acc); m.set(c, acc.length); return m; }, new Float32Array(0))
      : new Float32Array(0);
    if (merged.length < sr * 3) { // under ~3s = too short to clone well
      setError("That was too short — aim for at least 15 seconds.");
      setState("idle"); setElapsed(0); return;
    }
    const blob = encodeWav(merged, sr);
    blobRef.current = blob;
    setPreviewUrl(URL.createObjectURL(blob));
    setState("recorded");
  }, [state, cleanup]);

  async function start() {
    setError(null); setElapsed(0); chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (e) => { chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(ctx.destination);
      startedRef.current = Date.now();
      recordingRef.current = true;
      setState("recording");
      const tick = () => {
        const ms = Date.now() - startedRef.current;
        setElapsed(ms);
        if (ms >= MAX_MS) { stop(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(e && e.name === "NotAllowedError"
        ? "Mic access was blocked. Allow the microphone in your browser, then try again."
        : "Couldn't start recording on this device. You can upload a file instead.");
      setState("error");
    }
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); blobRef.current = null; setElapsed(0); setState("idle"); setError(null);
  }

  async function useRecording() {
    if (!blobRef.current) return;
    setState("uploading");
    const file = new File([blobRef.current], "voice-recording.wav", { type: "audio/wav" });
    try {
      await onUpload(file);
      setState("recorded");
    } catch {
      setError("Upload failed — please retry.");
      setState("recorded");
    }
  }

  const secs = Math.min(30, Math.floor(elapsed / 1000));
  const pct = Math.min(100, (elapsed / MAX_MS) * 100);

  return (
    <div className="bg-panel border border-edge rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm">{done ? "✓ Voice cloned" : "Record your voice"}</p>
        <span className="text-xs text-fog/60">~30 seconds</span>
      </div>

      {!done && (
        <>
          <p className="text-fog text-xs mb-3">Tap record and read this out loud (or just introduce yourself):</p>
          <div className="bg-ink border border-edge rounded-xl p-3 text-sm text-fog/90 leading-relaxed mb-4 italic">
            "{PROMPT}"
          </div>

          {state === "recording" && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-mint font-mono text-lg">0:{String(secs).padStart(2, "0")}</span>
                <span className="text-fog/50 text-xs">/ 0:30</span>
              </div>
              <div className="h-1.5 bg-edge rounded-full overflow-hidden">
                <div className="h-full bg-mint transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {previewUrl && state !== "recording" && (
            <audio src={previewUrl} controls className="w-full mb-4" />
          )}

          <div className="flex flex-wrap gap-3">
            {(state === "idle" || state === "error") && (
              <button onClick={start} className="bg-mint text-ink font-bold px-6 py-2.5 rounded-full hover:bg-mintdim transition">
                ● Start recording
              </button>
            )}
            {state === "recording" && (
              <button onClick={stop} className="bg-red-500 text-white font-bold px-6 py-2.5 rounded-full hover:bg-red-600 transition">
                ■ Stop
              </button>
            )}
            {state === "recorded" && (
              <>
                <button onClick={useRecording} className="bg-mint text-ink font-bold px-6 py-2.5 rounded-full hover:bg-mintdim transition">
                  Use this recording →
                </button>
                <button onClick={reRecord} className="text-fog border border-edge hover:border-mint hover:text-mint px-6 py-2.5 rounded-full transition">
                  Re-record
                </button>
              </>
            )}
            {state === "uploading" && (
              <span className="text-mint text-sm py-2.5">Cloning your voice…</span>
            )}
          </div>

          {error && <p className="text-red-400 mt-3 text-sm">{error}</p>}
        </>
      )}
    </div>
  );
}
