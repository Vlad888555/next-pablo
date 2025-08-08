import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email && !session?.user?.id) {
    return Response.json({ ok: false }, { status: 200 });
  }
  return Response.json({ ok: true });
}
