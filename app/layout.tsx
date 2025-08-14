import "./globals.css";
import Link from "next/link";
import SignOutButton from "./components/SignOutButton";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container nav">
            <Link className="link" href="/"><div className="brand">next-pablo </div></Link>
            <nav className="navlinks">
              <Link className="link" href="/room">Home</Link>
              <Link className="link" href="/register">Register</Link>
              <SignOutButton />
            </nav>
          </div>
        </header>
        <div className="container" style={{ paddingTop: 16 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
