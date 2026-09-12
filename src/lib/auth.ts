import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";


export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("🔍 Looking for user:", credentials?.email);

          if (!credentials?.email || !credentials?.password) {
            console.log("❌ Missing credentials");
            return null;
          }
          const email = credentials.email.toLowerCase();

          const user = await prisma.user.findUnique({
            where: { email: email },
          });

          if (!user) {
            console.log("❌ User not found:", email);
            return null;
          }

          console.log("✅ User found, checking password...");

          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isValid) {
            console.log("❌ Invalid password for:", credentials.email);
            return null;
          }

          console.log("✅ Login successful:", credentials.email);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId,
          };
        } catch (error) {
          console.error("❌ Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.departmentId = (user as any).departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).departmentId = token.departmentId as string | null;
      }
      return session;
    },
  },
  // ✅ AUDIT: record login / logout
  events: {
    async signIn({ user }) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: user.id as string,
            action: "USER_LOGIN",
            detail: `User logged in: ${user.email}`,
          },
        });
      } catch (e) {
        console.error("[audit] signIn log failed:", e);
      }
    },
    async signOut({ token }) {
      try {
        if (token?.id) {
          await prisma.auditLog.create({
            data: {
              userId: token.id as string,
              action: "USER_LOGOUT",
              detail: `User logged out: ${token.email ?? "unknown"}`,
            },
          });
        }
      } catch (e) {
        console.error("[audit] signOut log failed:", e);
      }
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};