// lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { redisClient } from '@/lib/redis';
import bcrypt from 'bcryptjs';
import { JWT } from 'next-auth/jwt';

export const {
  handlers: { GET, POST },
  signIn,
  signOut,
  auth
} = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing credentials');
        }

        // Get user from Redis
        const user = await redisClient.hGet(`users`, credentials.email as string);

        if (!user) {
          throw new Error('User not found');
        }

        // Check password
        const isValid = await bcrypt.compare(credentials.password as string, user.password);

        if (!isValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }

      if (account) {
        token.accessToken = account.access_token;
      }

      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      session.user.id = token.id;
      session.user.accessToken = token.accessToken;

      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
});

// Types for user
export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  created: Date;
  updated: Date;
}

// Helper function to create new user
// export async function createUser(userData: {
//   email: string;
//   password: string;
//   name: string;
// }) {
//   // Check if user exists
//   const existingUser = await redisClient.hGet('users', userData.email);
//
//   if (existingUser) {
//     throw new Error('User already exists');
//   }
//
//   // Hash password
//   const hashedPassword = await bcrypt.hash(userData.password, 12);
//
//   const newUser: User = {
//     id: crypto.randomUUID(),
//     email: userData.email,
//     name: userData.name,
//     password: hashedPassword,
//     created: new Date(),
//     updated: new Date(),
//   };
//
//   // Store user in Redis
//   await redisClient.hSet('users', userData.email, newUser);
//
//   // Return user without password
//   const { password, ...userWithoutPassword } = newUser;
//   return userWithoutPassword;
// }

// Middleware to protect API routes
export async function apiAuth(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return session.user.id;
}

// Usage in API route
export function authConfig(handler: Function) {
  return async function(req: Request, ...args: any[]) {
    const userId = await apiAuth(req);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return handler(req, ...args);
  };
}