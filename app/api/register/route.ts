// app/api/register/route.ts
import { NextResponse } from "next/server";
import { randomBytes, randomUUID, createHash } from "crypto";
import { getDb } from "@/db/drizzle";      // если alias не настроен — замените на относительный путь
import { users } from "@/db/schema.auth"; // проверьте путь
import { eq } from "drizzle-orm";

function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(password + salt).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const emailRaw = body?.email;
    const password = body?.password;
    const name = body?.name;

    if (!emailRaw || !password || !name) {
      return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
    }

    const email = String(emailRaw).trim().toLowerCase();
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Пароль должен быть минимум 6 символов" }, { status: 400 });
    }

    const db = getDb();

    // проверка существующего email
    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (found.length > 0) {
      return NextResponse.json({ error: "Email уже зарегистрирован" }, { status: 400 });
    }

    // соль + хэш в формате salt:hash (как у authorize)
    const salt = randomBytes(16).toString("hex");
    const hashed = hashPassword(password, salt);
    const passwordHash = `${salt}:${hashed}`;

    // вставка
    await db.insert(users).values({
      id: randomUUID(),
      email,
      name,
      passwordHash,
    });

    console.log("REGISTER: created user", { email, name }); // временный лог для отладки

    return NextResponse.json({ message: "Пользователь успешно зарегистрирован" }, { status: 201 });
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Ошибка сервера при регистрации" }, { status: 500 });
  }
}
