import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { department: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // Log the sign-in
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "USER_LOGIN",
            detail: `Login by ${user.email}`,
          },
        });

        return {
          id:           user.id,
          name:         user.name,
          email:        user.email,
          role:         user.role,
          departmentId: user.departmentId,
          department:   user.department?.name ?? null,
          staffId:      user.staffId,
          // PHOTO IS REMOVED FROM SESSION
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id           = (user as any).id;
        token.role         = (user as any).role;
        token.departmentId = (user as any).departmentId;
        token.department   = (user as any).department;
        token.staffId      = (user as any).staffId;
        // NO PHOTO in token
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id           = token.id;
        (session.user as any).role         = token.role;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).department   = token.department;
        (session.user as any).staffId      = token.staffId;
        // NO PHOTO in session
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  session: { strategy: "jwt" },
  secret:  process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };