import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { createServerClient } from './supabase';
import { hit } from './ratelimit';

if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
  // NextAuth v4 derives a secret from other config when this is unset, which
  // silently produces session tokens that differ between deployments and are
  // not tied to a value you control. Fail loudly instead.
  throw new Error('NEXTAUTH_SECRET must be set in production');
}

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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        /*
         * Throttled per source address *and* per target address. NextAuth
         * exposes no limiter of its own, so without this the credentials
         * endpoint accepts unlimited password guesses. See lib/ratelimit.ts
         * for why this is a speed bump rather than a guarantee.
         */
        const forwarded = (req?.headers?.['x-forwarded-for'] as string | undefined) ?? '';
        const ip = forwarded.split(',')[0].trim() || 'unknown';
        const email = credentials.email.trim().toLowerCase();
        if (!hit(`login-ip:${ip}`, 10, 15 * 60 * 1000).ok) return null;
        if (!hit(`login-acct:${email}`, 10, 15 * 60 * 1000).ok) return null;

        const db = createServerClient();
        const { data, error } = await db.auth.signInWithPassword({
          email,
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
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        // Google will hand back an unverified address for some workspace
        // configurations; adopting an account on one would let anyone who can
        // set that address on a Google profile claim the matching Ruang user.
        if ((profile as { email_verified?: boolean } | undefined)?.email_verified === false) {
          return false;
        }

        const db = createServerClient();

        const { data: existing } = await db
          .from('users')
          .select('id')
          .eq('email', user.email!)
          .maybeSingle();

        /*
         * Linking by email address alone.
         *
         * This is safe only while every account's address is proven, which is
         * why /api/auth/register now creates accounts *unconfirmed* and mails
         * a confirmation link. An address squatted by someone who does not own
         * it cannot be signed into with a password until that link is
         * followed, so adopting the row here hands the real owner an account
         * nobody else can reach.
         *
         * Residual risk, unchanged and standard for this pattern: if the real
         * owner follows a confirmation link from a registration they did not
         * start, the squatter's password becomes live. See SECURITY_REVIEW.md.
         */
        if (existing) {
          user.id = existing.id;
        } else {
          // Creates the Supabase auth user. The handle_new_user trigger
          // fires automatically and inserts the public.users row.
          const { data: authUser, error } = await db.auth.admin.createUser({
            email: user.email!,
            email_confirm: true,
            user_metadata: { name: user.name, avatar_url: user.image },
          });
          if (error || !authUser.user) return false;
          user.id = authUser.user.id;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) token.id = user.id;
      if (account) token.provider = account.provider;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; provider?: string }).id = token.id as string;
        (session.user as { id?: string; provider?: string }).provider = token.provider as string;
      }
      return session;
    },
  },
};
