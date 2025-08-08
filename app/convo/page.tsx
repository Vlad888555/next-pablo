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
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1>Conversation</h1>

      {/* Placeholder controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button disabled>Settings</button>
        <button disabled>Language</button>
        <button disabled>Help</button>
      </div>

      {/* Messages */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginTop: 16,
          minHeight: 240,
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.role === "user" ? "You" : "Assistant"}:</strong> {m.content}
          </div>
        ))}
      </div>

      {/* Text input fallback */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message"
          style={{ flex: 1 }}
        />
        <button onClick={handleSendText}>Send</button>
      </div>

      {/* Voice controls */}
      <div style={{ marginTop: 16 }}>
        {!isRecording ? (
          <button onClick={startRecording} style={{ padding: "12px 20px" }}>
            🎤 Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} style={{ padding: "12px 20px", background: "#ffe5e5" }}>
            ⏹ Stop Recording
          </button>
        )}
      </div>

      <audio ref={audioRef} hidden />
    </main>
  );
}
