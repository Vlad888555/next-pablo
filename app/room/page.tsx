import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function RoomPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = session.user.name || session.user.email || "User";

  return (
    <main>
      <div className="card" style={{ maxWidth: 700, margin: "48px auto" }}>
        <div className="card-inner">
          <h2>Welcome, {name}</h2>
          <p className="footer-note">This is your personal room.</p>
          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href="/">Start a Conversation</a>
          </div>
        </div>
      </div>
    </main>
  );
}
