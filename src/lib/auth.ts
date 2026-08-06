import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { createServerClient } from './supabase';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const db = createServerClient();
        const { data, error } = await db.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (error || !data.user) return null;
        return {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || data.user.email!.split('@')[0],
          image: data.user.user_metadata?.avatar_url || null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const db = createServerClient();
        const { data: existing } = await db
          .from('users')
          .select('id')
          .eq('email', user.email!)
          .single();
        if (!existing) {
          const { data: authUser } = await db.auth.admin.createUser({
            email: user.email!,
            email_confirm: true,
            user_metadata: { name: user.name, avatar_url: user.image },
          });
          if (authUser.user) {
            await db.from('users').insert({
              id: authUser.user.id,
              email: user.email!,
              name: user.name || user.email!.split('@')[0],
              avatar_url: user.image || null,
            });
            user.id = authUser.user.id;
          }
        } else {
          user.id = existing.id;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};
