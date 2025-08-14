import { auth } from "@/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.email && !session?.user?.id) {
    return false;
  }
  return true;
}
