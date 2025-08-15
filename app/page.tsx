"use client";

import { useEffect, useRef, useState } from "react";


function hasCyrillic(s: string) {
  return /[\u0400-\u04FF]/.test(s);
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("");
  const currentLangRef = useRef<string>("en-US");
  const lastLangsRef = useRef<string[]>([]);
  const sendingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(() => {
    if (loggedIn && !connected) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const waitAudioEnded = (audio: HTMLAudioElement) =>
    new Promise<void>((resolve) => {
      const onEnd = () => {
        audio.removeEventListener("ended", onEnd);
        resolve();
      };
      audio.addEventListener("ended", onEnd);
    });

  const connect = async () => {
    setStatus("Connecting...");
    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) {
        setStatus("Browser does not support Speech Recognition API");
        return;
      }

      const recognition: SpeechRecognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLangRef.current;

      recognition.onend = () => {
        if (connected && !sendingRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
        setStatus(`SpeechRecognition error: ${ev.error}`);
      };

      recognition.onresult = async (event: SpeechRecognitionEvent) => {
        const lastResult = event.results[event.results.length - 1];
        const transcriptRaw = lastResult[0].transcript || "";
        const transcript = transcriptRaw.trim();
        const isFinal = lastResult.isFinal;

        if (!transcript) return;

        // detect language stabilize
        const detectedLang = hasCyrillic(transcript) ? "ru-RU" : "en-US";
        lastLangsRef.current.push(detectedLang);
        if (lastLangsRef.current.length > 3) lastLangsRef.current.shift();
        const counts = lastLangsRef.current.reduce((acc: Record<string, number>, l) => {
          acc[l] = (acc[l] || 0) + 1;
          return acc;
        }, {});
        const mostFrequentLang = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];

        if (mostFrequentLang && mostFrequentLang !== currentLangRef.current) {
          currentLangRef.current = mostFrequentLang;
          try { recognition.stop(); } catch {}
          setTimeout(() => {
            try { recognition.lang = mostFrequentLang; recognition.start(); } catch {}
          }, 200);
          return;
        }

        if (!isFinal) return;
        if (sendingRef.current) {
          console.log("Ignored final because currently sending/playing");
          return;
        }

        // mark busy and stop recognition to avoid capturing user's voice during playback
        sendingRef.current = true;
        try {
          try { recognition.stop(); } catch {}
          setStatus("Processing (Groq)...");

          // Get full reply from Groq (no streaming)
          const groqRes = await fetch("/api/groq/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: transcript, lang: currentLangRef.current }),
          });

          if (!groqRes.ok) {
            const txt = await groqRes.text().catch(() => "");
            throw new Error("Groq failed: " + txt);
          }

          const groqJson = await groqRes.json();
          const fullResponse = (groqJson.reply || groqJson.text || "").toString().trim();

          if (!fullResponse) {
            setStatus("No assistant response");
            sendingRef.current = false;
            try { recognition.start(); } catch {}
            return;
          }

          console.log("Full assistant response:", fullResponse);

          // TTS request (one request only)
          setStatus("Synthesizing speech...");
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: fullResponse, lang: currentLangRef.current }),
          });

          if (!ttsRes.ok) {
            // try to parse provider JSON error
            let errMsg = "TTS request failed";
            try {
              const errJson = await ttsRes.json();
              errMsg = `${errJson.error || errJson.message || "TTS failed"}${errJson.provider ? ` (provider: ${errJson.provider})` : ""}${errJson.details ? ` — ${String(errJson.details).slice(0, 300)}` : ""}`;
            } catch {
              const txt = await ttsRes.text().catch(() => "");
              if (txt) errMsg = txt;
            }
            console.error("TTS error:", errMsg);
            setStatus(errMsg);
            sendingRef.current = false;
            try { recognition.start(); } catch {}
            return;
          }

          const audioBlob = await ttsRes.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          try {
            await audio.play();
          } catch (playErr) {
            console.warn("audio.play() rejected, using browser fallback", playErr);
            URL.revokeObjectURL(audioUrl);
            // fallback to browser TTS so user hears something
            const u = new SpeechSynthesisUtterance(fullResponse);
            u.lang = currentLangRef.current.startsWith("ru") ? "ru-RU" : "en-US";
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
            await new Promise<void>((resolve) => {
              u.onend = () => resolve();
              u.onerror = () => resolve();
            });
            sendingRef.current = false;
            setStatus("Ready (fallback)");
            try { recognition.start(); } catch {}
            return;
          }

          await waitAudioEnded(audio);
          URL.revokeObjectURL(audioUrl);

          sendingRef.current = false;
          setStatus("Ready");
          try { recognition.start(); } catch {}
        } catch (err: any) {
          console.error("Processing / TTS error:", err);
          setStatus("Error: " + (err.message || String(err)));
          sendingRef.current = false;
          try { recognition.start(); } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setConnected(true);
      setStatus("Ready");
    } catch (err: any) {
      console.error("Connect failed", err);
      setStatus("Connect error: " + (err?.message || String(err)));
    }
  };

  const disconnect = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
    setConnected(false);
    setStatus("Disconnected");
  };

  if (checking) return null;

  if (!loggedIn) {
    return (
      <main>
        <div style={{ maxWidth: 1000, margin: "40px auto" }}>
          <h2>Welcome</h2>
          <div>Register or Login to start a real-time conversation.</div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div style={{ maxWidth: 900, margin: "24px auto" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h2>Your Room — Realtime Conversation</h2>
            <div style={{ gap: 8 }}>
              {!connected ? <button onClick={connect}>Connect</button> : <button onClick={disconnect}>Disconnect</button>}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            Status: {status} {sendingRef.current ? "(busy)" : ""}
          </div>

          <div style={{ marginTop: 12 }}>
            <p>Speak freely. The assistant detects your language and replies in the same language with a matching voice.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
