"use client";

import { useEffect, useRef, useState } from "react";

// Map languages to Realtime/OpenAI voice names
const VOICES = {
  en: "verse", // English preset
  ru: "alloy", // Example Russian-capable voice (adjust as needed)
};

type Lang = keyof typeof VOICES;

export default function RealtimePage() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Create and connect WebRTC peer
  const connect = async () => {
    setStatus("Connecting...");
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    // For audio playback
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      audioEl.srcObject = remoteStream;
      audioEl.play().catch(() => {});
    };

    // Capture mic
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = mic;
    mic.getTracks().forEach((t) => pc.addTrack(t, mic));

    // Data channel for control messages
    const dc = pc.createDataChannel("oai-events");
    dc.onopen = () => {
      setConnected(true);
      setStatus("Connected");
      // Update voice based on selected language
      const voice = VOICES[lang];
      dc.send(JSON.stringify({ type: "response.create", response: { instructions: `You are a helpful assistant. Speak ${lang === "ru" ? "Russian" : "English"}.` } }));
      dc.send(JSON.stringify({ type: "session.update", session: { voice } }));
    };

    // Create offer
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);

    // Fetch ephemeral server session for OpenAI Realtime
    const tokenRes = await fetch("/api/voice/realtime/session", { method: "POST" });
    if (!tokenRes.ok) {
      setStatus("Failed to get session token");
      return;
    }
    const { client_secret } = await tokenRes.json();

    // Send SDP to OpenAI Realtime
    const sdpResp = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${client_secret.value}`,
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
  };

  const disconnect = () => {
    pcRef.current?.close();
    pcRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setConnected(false);
    setStatus("Disconnected");
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <main>
      <div className="card" style={{ maxWidth: 900, margin: "24px auto" }}>
        <div className="card-inner">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Realtime Conversation</h2>
            <div className="row">
              <select className="input" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
              {!connected ? (
                <button className="btn btn-success" onClick={connect}>Connect</button>
              ) : (
                <button className="btn btn-danger" onClick={disconnect}>Disconnect</button>
              )}
            </div>
          </div>

          <div className="footer-note" style={{ marginTop: 8 }}>Status: {status}</div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-inner">
              <p className="footer-note">Speak after connecting. The assistant replies in the selected language using a different voice.</p>
              <audio ref={audioRef} autoPlay playsInline />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
