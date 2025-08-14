"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  const handleClick = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <button className="btn" onClick={handleClick}>
      Sign out
    </button>
  );
}
