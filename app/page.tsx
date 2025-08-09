"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

// Voices for different languages (adjust to the best multilingual voices available)
const EN_VOICE = "verse"; // English
const RU_VOICE = "alloy"; // Russian-capable example

function hasCyrillic(s: string) {
  return /[\u0400-\u04FF]/.test(s);
}

export default function Home() {
  // Auth state via /api/auth/session
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  // Register form state (separate from login)
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Login form state (separate from register)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);

  // Realtime state
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("");
  const currentVoiceRef = useRef<string>(EN_VOICE);

  // Check session
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session");
        const j = await r.json();
        setLoggedIn(!!j?.user);
      } catch (_) {
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

  async function handleRegister() {
    setMsg(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword, name: regName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Registration failed");
        return;
      }
      const s = await signIn("credentials", { redirect: false, email: regEmail, password: regPassword });
      if (s?.error) {
        setMsg(s.error);
      } else {
        setLoggedIn(true);
      }
    } catch (e: any) {
      setMsg(e?.message || "Registration error");
    }
  }

  async function handleLogin() {
    setMsg(null);
    const res = await signIn("credentials", { redirect: false, email: loginEmail, password: loginPassword });
    if (res?.error) setMsg(res.error);
    else setLoggedIn(true);
  }

  const connect = async () => {
    try {
      setStatus("Connecting...");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio
      const audioEl = audioRef.current!;
      const remoteStream = new MediaStream();
      pc.ontrack = (event) => {
        remoteStream.addTrack(event.track);
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => {});
      };

      // Mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // Data channel
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;
      dc.onopen = () => {
        setConnected(true);
        setStatus("Connected");
        // Set default voice and instruction to mirror user's language
        currentVoiceRef.current = EN_VOICE;
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              voice: currentVoiceRef.current,
              instructions:
                "You are a helpful assistant. Always reply in the same language the user is speaking.",
              modalities: ["text", "audio"],
            },
          })
        );
      };

      // Language auto-detection from incoming partial text events
      dc.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          const textCandidates: string[] = [];
          // try known fields
          if (obj?.delta && typeof obj.delta === "string") textCandidates.push(obj.delta);
          if (obj?.response?.output_text?.delta && typeof obj.response.output_text.delta === "string")
            textCandidates.push(obj.response.output_text.delta);
          if (obj?.text && typeof obj.text === "string") textCandidates.push(obj.text);

          for (const t of textCandidates) {
            const wantVoice = hasCyrillic(t) ? RU_VOICE : EN_VOICE;
            if (wantVoice !== currentVoiceRef.current) {
              currentVoiceRef.current = wantVoice;
              dc.send(
                JSON.stringify({ type: "session.update", session: { voice: currentVoiceRef.current } })
              );
            }
          }
        } catch (_) {
          // ignore non-JSON events
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
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
    } catch (e: any) {
      setStatus(e?.message || "Connect error");
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
    } catch (e) {
      // ignore
    }
  };

  if (checking) return null;

  // Not logged in: show combined Register + Login on the same page
  if (!loggedIn) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 1000, margin: "40px auto" }}>
          <div className="card-inner" style={{ display: "grid", gap: 16 }}>
            <h2>Welcome</h2>
            <div className="footer-note">Register or Login to start a real-time conversation.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="card">
                <div className="card-inner" style={{ display: "grid", gap: 8 }}>
                  <h3>Create account</h3>
                  <input className="input" id="reg-name" name="reg-name" autoComplete="name" placeholder="Name" value={regName} onChange={(e) => setRegName(e.target.value)} />
                  <input className="input" id="reg-email" name="reg-email" autoComplete="email" placeholder="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  <input className="input" id="reg-password" name="reg-password" autoComplete="new-password" placeholder="Password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                  <button className="btn btn-primary" onClick={handleRegister}>Register</button>
                </div>
              </div>
              <div className="card">
                <div className="card-inner" style={{ display: "grid", gap: 8 }}>
                  <h3>Login</h3>
                  <input className="input" id="login-email" name="login-email" autoComplete="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  <input className="input" id="login-password" name="login-password" autoComplete="current-password" placeholder="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  <button className="btn btn-primary" onClick={handleLogin}>Login</button>
                </div>
              </div>
            </div>
            {msg && <div>{msg}</div>}
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
          <div className="footer-note" style={{ marginTop: 8 }}>Status: {status}</div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-inner">
              <p className="footer-note">Speak freely. The assistant detects your language and replies in the same language with a matching voice.</p>
              <audio ref={audioRef} autoPlay playsInline />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
