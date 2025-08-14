"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

// Define types for Web Speech API (only for non-standard or to augment)
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// Use built-in types for SpeechSynthesis
// No need to redefine SpeechSynthesis, SpeechSynthesisVoice, SpeechSynthesisUtterance as they are in lib.dom.d.ts

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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("");
  const currentLangRef = useRef<string>("en-US");

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Registration error";
      setMsg(message);
    }
  }

  async function handleLogin() {
    setMsg(null);
    const res = await signIn("credentials", { redirect: false, email: loginEmail, password: loginPassword });
    if (res?.error) setMsg(res.error);
    else setLoggedIn(true);
  }

  const connect = async () => {
    setStatus("Connecting...");
    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      const synthesis = window.speechSynthesis;

      if (!SpeechRecognitionClass) {
        setStatus("Browser does not support Speech Recognition API");
        return;
      }

      const recognition: SpeechRecognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLangRef.current;

      recognition.onresult = async (event: SpeechRecognitionEvent) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript;
        const isFinal = lastResult.isFinal;

        // Detect language from text
        const detectedLang = hasCyrillic(transcript) ? "ru-RU" : "en-US";

        if (detectedLang !== currentLangRef.current) {
          currentLangRef.current = detectedLang;
          recognition.lang = detectedLang;
        }

        if (isFinal) {
          try {
            // Send to server proxy for Groq API completion
            const res = await fetch("/api/groq/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: transcript,
                lang: detectedLang,
              }),
            });
            if (!res.ok) {
              throw new Error("Groq response failed");
            }
            const { response } = await res.json();

            // Use browser TTS to speak the response
            const utterance = new SpeechSynthesisUtterance(response);
            utterance.lang = detectedLang;
            
            console.log("Groq response:", response);
            // Select a voice matching the language
            
            const ttsRes = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: response }),
            });
            
            if (!ttsRes.ok) {
              console.error("TTS error", await ttsRes.text());
              return;
            }

            const audioBlob = await ttsRes.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            new Audio(audioUrl).play();

            }catch (e) {
            console.error(e);
            setStatus("Error processing response");
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setStatus(`Error: ${event.error}`);
      };

      recognition.onend = () => {
        if (connected) {
          recognition.start(); // Restart for continuous listening
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setConnected(true);
      setStatus("Ready");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Connect error";
      setStatus(message);
    }
  };

  const disconnect = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setConnected(false);
    setStatus("Disconnected");
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
                <button className="btn btn-success" onClick={connect}>
                  Connect
                </button>
              ) : (
                <button className="btn btn-danger" onClick={disconnect}>
                  Disconnect
                </button>
              )}
            </div>
          </div>
          <div className="footer-note" style={{ marginTop: 8 }}>Status: {status}</div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-inner">
              <p className="footer-note">
                Speak freely. The assistant detects your language and replies in the same language with a matching voice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}