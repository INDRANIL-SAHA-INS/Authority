import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInSchema } from "./lib/zod";
import { prisma } from "./lib/prisma";
import { ZodError } from "zod";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          // Validate input with Zod
          const { email, password } = await signInSchema.parseAsync(credentials);

          // Fetch user from DB
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.password_hash) {
            throw new Error("Invalid credentials.");
          }

          // Match password word by word (plaintext) as requested
          const isPasswordValid = password === user.password_hash;

          if (!isPasswordValid) {
            throw new Error("Invalid credentials.");
          }

          // Return user object, mapping BigInt to string to avoid serialization errors
          return {
            id: user.user_id.toString(),
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          if (error instanceof ZodError) {
            return null;
          }
          throw error;
        }
      },
    }),
  ],
});
