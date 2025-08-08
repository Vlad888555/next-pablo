"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function ConvoPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  const startRecording = async () => {
    // Require login before recording
    const s = await fetch("/api/me").then((r) => r.json()).catch(() => ({ ok: false }));
    if (!s?.ok) {
      alert("Please login to use voice recording.");
      window.location.href = "/login";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleAudioBlob(blob);
        // stop all tracks
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setMediaRecorder(mr);
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      alert("Microphone permission or recording failed.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder) return;
    if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
    setIsRecording(false);
    setMediaRecorder(null);
  };

  const handleAudioBlob = async (blob: Blob) => {
    try {
      // 1) STT
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const sttRes = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
      if (!sttRes.ok) throw new Error("STT failed");
      const { text: userText } = await sttRes.json();
      if (!userText) return;
      setMessages((prev) => [...prev, { role: "user", content: userText }]);

      // 2) Agent reply text
      const replyRes = await fetch("/api/voice/reply-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
      });
      if (!replyRes.ok) throw new Error("Agent reply failed");
      const { reply } = await replyRes.json();
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      // 3) TTS for reply
      const ttsRes = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      if (ttsRes.ok) {
        const ab = await ttsRes.arrayBuffer();
        const audioBlob = new Blob([ab], { type: "audio/mpeg" });
        const url = URL.createObjectURL(audioBlob);
        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play().catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendText = async () => {
    // Require login before sending
    const s = await fetch("/api/me").then((r) => r.json()).catch(() => ({ ok: false }));
    if (!s?.ok) {
      alert("Please login to send messages.");
      window.location.href = "/login";
      return;
    }
    const userText = input.trim();
    if (!userText) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);

    const replyRes = await fetch("/api/voice/reply-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userText }),
    });
    if (!replyRes.ok) return;
    const { reply } = await replyRes.json();
    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

    const ttsRes = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: reply }),
    });
    if (ttsRes.ok) {
      const ab = await ttsRes.arrayBuffer();
      const audioBlob = new Blob([ab], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => {});
      }
    }
  };

  return (
    <main>
      <div className="card" style={{ maxWidth: 900, margin: "24px auto" }}>
        <div className="card-inner">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Conversation</h2>
            <div className="row">
              <button className="btn" disabled>Settings</button>
              <button className="btn" disabled>Language</button>
              <button className="btn" disabled>Help</button>
            </div>
          </div>

          <div className="messages card" style={{ marginTop: 12 }}>
            <div className="card-inner">
              {messages.length === 0 && (
                <div className="footer-note">Start with a message or record your voice.</div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
                  <strong>{m.role === "user" ? "You" : "Assistant"}:</strong> {m.content}
                </div>
              ))}
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message" />
            <button className="btn btn-primary" onClick={handleSendText}>Send</button>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            {!isRecording ? (
              <button className="btn btn-success" onClick={startRecording}>🎤 Start Recording</button>
            ) : (
              <button className="btn btn-danger" onClick={stopRecording}>⏹ Stop Recording</button>
            )}
          </div>

          <audio ref={audioRef} hidden />
        </div>
      </div>
    </main>
  );
}
