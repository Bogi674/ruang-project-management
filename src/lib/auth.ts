import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createServiceClient } from "./supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days default
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      const db = createServiceClient();

      const { data: existing } = await db
        .from("users")
        .select("id, role")
        .eq("email", user.email!)
        .single();

      if (!existing) {
        const { count } = await db
          .from("users")
          .select("id", { count: "exact", head: true });

        const role = count === 0 ? "admin" : "member";
        await db.from("users").insert({
          email: user.email!,
          name: user.name!,
          avatar_url: user.image,
          role,
        });
      } else {
        await db
          .from("users")
          .update({ name: user.name!, avatar_url: user.image, updated_at: new Date().toISOString() })
          .eq("email", user.email!);
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (account && user) {
        const db = createServiceClient();
        const { data } = await db
          .from("users")
          .select("id, public_id, role, session_timeout_minutes")
          .eq("email", user.email!)
          .single();

        if (data) {
          token.userId = data.id;
          token.publicId = data.public_id;
          token.role = data.role;
          token.sessionTimeout = data.session_timeout_minutes;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.publicId = token.publicId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      publicId: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    publicId?: string;
    role?: string;
    sessionTimeout?: number;
  }
}
