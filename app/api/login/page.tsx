"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) setMsg(res.error);
    else window.location.href = "/";
  };

  return (
    <main>
      <div className="card" style={{ maxWidth: 520, margin: "48px auto" }}>
        <div className="card-inner stack">
          <h2>Login</h2>
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="row">
            <button className="btn btn-primary" onClick={submit}>Login</button>
          </div>
          {msg && <div>{msg}</div>}
          <div className="footer-note">Don&apos;t have an account? <a className="link" href="/register">Register</a></div>
        </div>
      </div>
    </main>
  );
}
