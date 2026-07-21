import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyUser = any

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        username: { label: 'Username', type: 'text' },
        isSignUp: { label: 'isSignUp', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()

        if (credentials.isSignUp === 'true') {
          const exists = await db.user.findFirst({ where: { email } })
          if (exists) throw new Error('Email already registered')
          const base = (credentials.username?.trim() ||
            email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'user').slice(0, 18)
          // Ensure unique username by appending a number if taken
          let username = base
          let suffix = 1
          while (await (db.user as any).findFirst({ where: { username } })) {
            username = `${base}${suffix++}`
          }
          const hashed = await bcrypt.hash(credentials.password, 10)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const user = await (db.user as any).create({
            data: { email, username, passwordHash: hashed },
          }) as AnyUser
          return { id: user.id, email: user.email, name: user.username, image: user.avatar }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const user = await (db.user as any).findFirst({ where: { email } }) as AnyUser
          if (!user || !user.passwordHash) throw new Error('No account found with this email')
          const valid = await bcrypt.compare(credentials.password, user.passwordHash)
          if (!valid) throw new Error('Incorrect password')
          return { id: user.id, email: user.email, name: user.username, image: user.avatar }
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const existing = await db.user.findFirst({ where: { email: user.email! } })
        if (existing) {
          await db.user.update({
            where: { id: existing.id },
            data: { avatar: user.image || undefined },
          })
        } else {
          await db.user.create({
            data: {
              email: user.email!,
              username: (user.name || user.email!.split('@')[0]).replace(/\s+/g, '').slice(0, 20),
              avatar: user.image || undefined,
            },
          })
        }
      }
      return true
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await db.user.findFirst({ where: { email: session.user.email } })
        if (dbUser) {
          session.user.id = dbUser.id
          session.user.username = dbUser.username
          session.user.image = dbUser.avatar || session.user.image
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }