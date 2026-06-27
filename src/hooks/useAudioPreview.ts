// Audio preview monitor (Epic 4).
// ---------------------------------------------------------------------------
// The preview <video> element is kept muted because it is the frame clock. To
// let the user HEAR the degraded audio while editing, we decode the source once,
// run it through the SAME degrade DSP the export uses (degradeAudioBuffer — so
// what you hear is what you get), and play the resulting AudioBuffer through Web
// Audio, kept in sync with the muted video's play/pause/seek.
import { useEffect, useRef, useState } from "react";
import { degradeAudioBuffer, type AudioProfile } from "@/lib/audio-degrade";

export const DEFAULT_AUDIO_PROFILE: AudioProfile = {
  lowCutHz: 20, highCutHz: 20000,
  hiss: 0, hum: 0, wow: 0, flutter: 0, mono: 0,
  mp3: 0, telephone: 0, companding: 0, crackle: 0, silent: 0,
  gain: 1, fadeIn: 0, fadeOut: 0,
};

interface UseAudioPreviewArgs {
  videoEl: HTMLVideoElement | null;
  sourceKey: number;            // bumps when a new source is loaded
  hasAudio: boolean;
  profile: AudioProfile;
}

export function useAudioPreview({ videoEl, sourceKey, hasAudio, profile }: UseAudioPreviewArgs): {
  decodedBuffer: AudioBuffer | null;
  ready: boolean;
} {
  const ctxRef = useRef<AudioContext | null>(null);
  const decodedRef = useRef<AudioBuffer | null>(null);
  const degradedRef = useRef<AudioBuffer | null>(null);
  const nodeRef = useRef<AudioBufferSourceNode | null>(null);
  const renderTokenRef = useRef(0);
  const [decodedBuffer, setDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [ready, setReady] = useState(false);

  // Lazily create the AudioContext (resumed on play, which is a user gesture).
  function ctx(): AudioContext | null {
    if (ctxRef.current) return ctxRef.current;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctxRef.current = new AC(); } catch { return null; }
    return ctxRef.current;
  }

  function stopPlayback() {
    if (nodeRef.current) {
      try { nodeRef.current.stop(); } catch { /* already stopped */ }
      try { nodeRef.current.disconnect(); } catch { /* noop */ }
      nodeRef.current = null;
    }
  }

  function startPlayback(offsetSec: number) {
    const c = ctx();
    const buf = degradedRef.current;
    if (!c || !buf) return;
    stopPlayback();
    if (c.state === "suspended") c.resume().catch(() => {});
    const node = c.createBufferSource();
    node.buffer = buf;
    node.connect(c.destination);
    const off = Math.max(0, Math.min(buf.duration - 0.001, offsetSec || 0));
    try { node.start(0, off); } catch { return; }
    nodeRef.current = node;
  }

  // Decode the source audio once per loaded source.
  useEffect(() => {
    let cancelled = false;
    decodedRef.current = null;
    degradedRef.current = null;
    setDecodedBuffer(null);
    setReady(false);
    stopPlayback();
    if (!videoEl || !hasAudio) return;
    const c = ctx();
    const src = videoEl.currentSrc || videoEl.src;
    if (!c || !src) return;
    (async () => {
      try {
        const resp = await fetch(src);
        const arr = await resp.arrayBuffer();
        if (cancelled) return;
        const decoded = await c.decodeAudioData(arr);
        if (cancelled) return;
        decodedRef.current = decoded;
        setDecodedBuffer(decoded);
        setReady(true);
      } catch { /* no decodable audio; leave silent */ }
    })();
    return () => { cancelled = true; stopPlayback(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl, sourceKey, hasAudio]);

  // Re-render the degraded buffer when the profile changes (debounced), and
  // restart playback in place if the video is currently playing.
  useEffect(() => {
    if (!decodedRef.current) return;
    const token = ++renderTokenRef.current;
    const t = setTimeout(async () => {
      try {
        const out = await degradeAudioBuffer(decodedRef.current as AudioBuffer, profile);
        if (token !== renderTokenRef.current) return; // superseded
        degradedRef.current = out;
        if (videoEl && !videoEl.paused) startPlayback(videoEl.currentTime);
      } catch { /* keep previous */ }
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, decodedBuffer]);

  // Keep audio playback locked to the muted video's transport.
  useEffect(() => {
    if (!videoEl) return;
    const onPlay = () => startPlayback(videoEl.currentTime);
    const onPause = () => stopPlayback();
    const onSeeking = () => stopPlayback();
    const onSeeked = () => { if (!videoEl.paused) startPlayback(videoEl.currentTime); };
    const onEnded = () => stopPlayback();
    videoEl.addEventListener("play", onPlay);
    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("seeking", onSeeking);
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.addEventListener("ended", onEnded);
    return () => {
      videoEl.removeEventListener("play", onPlay);
      videoEl.removeEventListener("pause", onPause);
      videoEl.removeEventListener("seeking", onSeeking);
      videoEl.removeEventListener("seeked", onSeeked);
      videoEl.removeEventListener("ended", onEnded);
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl, sourceKey]);

  useEffect(() => () => { stopPlayback(); try { ctxRef.current?.close(); } catch { /* noop */ } }, []);

  return { decodedBuffer, ready };
}
