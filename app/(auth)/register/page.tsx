"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Registration failed");
    } else {
      // Auto-login after registration
      const signinRes = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (signinRes.ok) {
        window.location.href = "/room";
      } else {
        setMsg("Registered. Please login.");
      }
    }
  };

  return (
    <main>
      <div className="card" style={{ maxWidth: 520, margin: "48px auto" }}>
        <div className="card-inner stack">
          <h2>Register</h2>
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="row">
            <button className="btn btn-primary" onClick={submit}>Create account</button>
          </div>
          {msg && <div>{msg}</div>}
          <div className="footer-note">Already have an account? <a className="link" href="/login">Login</a></div>
        </div>
      </div>
    </main>
  );
}
