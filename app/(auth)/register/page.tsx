"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface RegisterResponse {
  error?: string;
  [key: string]: unknown;
}
export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMsg(null);

    // client-side validation
    if (!name.trim()) { setMsg("Имя обязательно."); return; }
    if (!email.includes("@")) { setMsg("Пожалуйста, введите корректный email."); return; }
    if (password.length < 6) { setMsg("Пароль должен быть минимум 6 символов."); return; }

    setIsLoading(true);

    try {
      const res = await fetch("/api/register", {            // <- endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const ct = res.headers.get("content-type") || "";

      if (!ct.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response from /api/register:", text);
        setMsg("Сервер вернул неожиданный ответ. Посмотри консоль.");
        setIsLoading(false);
        return;
      }
        const data: RegisterResponse = await res.json();

      if (!res.ok) {
        setMsg(data?.error || "Ошибка регистрации. Попробуйте снова.");
        setIsLoading(false);
        return;
      }

      // сразу логиним пользователя через NextAuth credentials
      const loginRes = await signIn("credentials", { redirect: false, email, password });
      if (loginRes?.error) {
        setMsg(loginRes.error || "Ошибка входа после регистрации.");
        setIsLoading(false);
        return;
      }

      // успех — переходим на /room (или /)
      router.push("/");
    } catch (err) {
      console.error("Ошибка регистрации:", err);
      setMsg("Произошла непредвиденная ошибка. Попробуйте снова.");
      setIsLoading(false);
    }
  };

  return (
    <main>
      <div className="card" style={{ maxWidth: 520, margin: "48px auto" }}>
        <div className="card-inner stack">
          <h2>Регистрация</h2>

          <form onSubmit={submit}>
            <input className="input" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
            <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            <input className="input" placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={isLoading}>
                {isLoading ? "Создание..." : "Создать аккаунт"}
              </button>
            </div>
          </form>

          {msg && <div className="error" style={{ marginTop: 12 }}>{msg}</div>}
          <div className="footer-note" style={{ marginTop: 12 }}>
            Уже есть аккаунт? <a className="link" href="/login">Войти</a>
          </div>
        </div>
      </div>
    </main>
  );
}
