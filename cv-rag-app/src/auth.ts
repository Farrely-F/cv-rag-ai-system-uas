/**
 * NextAuth.js v5 Configuration
 * Uses Credentials provider for admin authentication
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          return null;
        }

        // Get admin credentials from environment
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        // Check if email matches admin
        if (email !== adminEmail) {
          return null;
        }

        // For development: allow plain text password comparison if no hash is set
        if (adminPasswordHash) {
          const isValid = await compare(password, adminPasswordHash);
          if (!isValid) {
            return null;
          }
        } else {
          // Development mode: check against plain ADMIN_PASSWORD
          const adminPassword = process.env.ADMIN_PASSWORD;
          if (password !== adminPassword) {
            return null;
          }
        }

        // Return user object
        return {
          id: "admin",
          email: adminEmail,
          name: "Admin",
          role: "admin",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");

      if (isOnAdmin) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
