export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>next-pablo</h1>
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <a href="/convo">Go to Conversation</a>
        <a href="/test">Go to /test</a>
      </div>
    </main>
  );
}
