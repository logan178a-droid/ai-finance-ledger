import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// NOTE: the installed package is next-auth v4 (^4.24.15), not the v5 "Auth.js"
// beta. v4's App Router integration exports a single `NextAuthOptions` object
// consumed by the route handler (`src/app/api/auth/[...nextauth]/route.ts`)
// and by `getServerSession(authOptions)` wherever a server-side session is
// needed — there is no `auth()` helper in v4, so `getAuthSession()` below is
// our stand-in for it.
//
// JWT session strategy (not database sessions): the Credentials provider is
// explicitly documented by NextAuth as incompatible with database sessions
// (there's no OAuth token exchange to persist), so JWT is the only strategy
// that works here. The Prisma adapter is still wired up for its `User`
// persistence needs elsewhere, but sessions themselves live in a signed JWT
// cookie.
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
};

/** Server-side session accessor — the v4 stand-in for v5's `auth()`. */
export function getAuthSession() {
  return getServerSession(authOptions);
}
