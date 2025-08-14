"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

// UI labels for voices; actual ElevenLabs voice IDs are configured on the server via .env
const EN_VOICE = "EN"; // neutral English voice
const RU_VOICE = "RU"; // natural Russian voice

type Lang = "en" | "ru";

function hasCyrillic(s: string) {
  return /[\u0400-\u04FF]/.test(s);
}

function detectLangFromText(s: string): Lang | null {
  if (!s) return null;
  if (hasCyrillic(s)) return "ru";
  if (/[A-Za-z]/.test(s) && !/[\u0400-\u04FF]/.test(s)) return "en";
  return null;
}

function voiceLabelForLang(lang: Lang) {
  return lang === "ru" ? RU_VOICE : EN_VOICE;
}

export default function Room() {
  // Auth state via /api/auth/session
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  // Realtime state
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("");
  const currentVoiceRef = useRef<string>(EN_VOICE);
  const [currentVoice, setCurrentVoice] = useState<string>(EN_VOICE);

  // Assistant text buffer and playback queue for ElevenLabs TTS
  const assistantBufferRef = useRef<string>("");
  const playbackQueueRef = useRef<Blob[]>([]);
  const playingRef = useRef(false);

  const playBlob = async (blob: Blob) => {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob);
      const audioEl = audioRef.current!;
      const onEnded = () => {
        audioEl.removeEventListener("ended", onEnded);
        URL.revokeObjectURL(url);
        resolve();
      };
      audioEl.addEventListener("ended", onEnded);
      audioEl.src = url;
      audioEl.play().catch(() => resolve());
    });
  };

  const enqueueAndPlay = async (blob: Blob) => {
    playbackQueueRef.current.push(blob);
    if (playingRef.current) return;
    playingRef.current = true;
    while (playbackQueueRef.current.length) {
      const b = playbackQueueRef.current.shift()!;
      await playBlob(b);
    }
    playingRef.current = false;
  };

  const synthesizeAndPlay = async (text: string, lang: Lang) => {
    try {
      const resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!resp.ok) {
        // Better diagnostics: try JSON, then text, then status
        try {
          const clone = resp.clone();
          const ct = clone.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const j = await clone.json();
            console.error("/api/tts error:", j);
            setStatus(`TTS error ${resp.status}`);
          } else {
            const t = await clone.text();
            console.error("/api/tts error text:", t || `(status ${resp.status})`);
            setStatus(`TTS error ${resp.status}`);
          }
        } catch (e) {
          console.error("/api/tts error status:", resp.status);
          setStatus(`TTS error ${resp.status}`);
        }
        return;
      }
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      await enqueueAndPlay(blob);
    } catch (e) {
      console.error("synthesizeAndPlay failed", e);
      setStatus("TTS error (client)");
    }
  };

  // Check session
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session");
        const j = await r.json();
        setLoggedIn(!!j?.user);
      } catch {
        setLoggedIn(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  // Auto-connect when logged in
  useEffect(() => {
    if (loggedIn && !connected) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const connect = async () => {
    try {
      setStatus("Connecting...");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        setStatus(st.charAt(0).toUpperCase() + st.slice(1));
        if (st === "failed" || st === "disconnected" || st === "closed") {
          setConnected(false);
        }
      };

      // We do not receive remote audio from OpenAI; audio is synthesized via ElevenLabs.

      // Mic
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = mic;
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // Data channel
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;
      dc.onopen = () => {
        setConnected(true);
        setStatus("Connected");
        // Default UI voice label
        currentVoiceRef.current = EN_VOICE;
        setCurrentVoice(EN_VOICE);
        // Disable OpenAI audio; only text will be produced
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions:
                "You are a helpful assistant. Always reply in the same language the user is speaking. If the user speaks English, use native, neutral (accent-free) English. If the user speaks Russian, speak natural Russian.",
            },
          })
        );
      };

      // Handle assistant text events; synthesize with ElevenLabs when a response completes
      dc.onmessage = async (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          console.log("OpenAI event:", obj);

          // accumulate text deltas for the assistant's output
          if (obj?.response?.output_text?.delta && typeof obj.response.output_text.delta === "string") {
            assistantBufferRef.current += obj.response.output_text.delta;
          } else if (typeof obj.delta === "string" && !obj.transcript) {
            // Some payloads expose assistant deltas directly as delta
            assistantBufferRef.current += obj.delta;
          }

          // Once the response is finalized, TTS the buffered text
          if (typeof obj.type === "string") {
            const t = obj.type;
            if (t === "response.completed" || t === "response.output_text.done" || t === "response.done") {
              const text = assistantBufferRef.current.trim();
              assistantBufferRef.current = "";
              if (text.length) {
                const lang = (detectLangFromText(text) || "en") as Lang;
                const label = voiceLabelForLang(lang);
                currentVoiceRef.current = label;
                setCurrentVoice(label);
                await synthesizeAndPlay(text, lang);
              }
            }
          }
        } catch {
          // ignore non-JSON events
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      const tokenRes = await fetch("/api/voice/realtime/session", { method: "POST" });
      if (!tokenRes.ok) {
        setStatus("Failed to get session token");
        return;
      }
      const { client_secret } = await tokenRes.json();

      const sdpResp = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${client_secret.value}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpResp.ok) {
        setStatus("SDP exchange failed");
        return;
      }

      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setStatus("Ready");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Connect error";
      setStatus(message);
    }
  };

  const disconnect = () => {
    try {
      pcRef.current?.close();
      pcRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      setConnected(false);
      setStatus("Disconnected");
    } catch {
      // ignore
    }
  };

  if (checking) return null;

  if (!loggedIn) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 800, margin: "40px auto" }}>
          <div className="card-inner" style={{ display: "grid", gap: 16 }}>
            <h2>Room</h2>
            <p className="footer-note">Please log in to access the realtime room.</p>
            <div>
              <Link className="btn btn-primary" href="/">Go to Login/Register</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Logged in: show real-time conversation (no toggles; language auto-detected)
  return (
    <main>
      <div className="card" style={{ maxWidth: 900, margin: "24px auto" }}>
        <div className="card-inner">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Your Room — Realtime Conversation</h2>
            <div className="row" style={{ gap: 8 }}>
              {!connected ? (
                <button className="btn btn-success" onClick={connect}>Connect</button>
              ) : (
                <button className="btn btn-danger" onClick={disconnect}>Disconnect</button>
              )}
            </div>
          </div>
          <div className="footer-note" style={{ marginTop: 8 }}>Status: {status} — Voice: {currentVoice}</div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-inner">
              <p className="footer-note">Speak freely. The assistant auto-detects your language and replies in the same language. English replies use a neutral, accent-free voice; Russian replies use a natural Russian voice.</p>
              <audio ref={audioRef} autoPlay playsInline />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
