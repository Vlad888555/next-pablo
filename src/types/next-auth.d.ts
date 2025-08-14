import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
    } & DefaultSession["user"]; // name, email, image
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
