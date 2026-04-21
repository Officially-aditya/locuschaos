import GithubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const githubClientId = process.env.GITHUB_CLIENT_ID?.trim()
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim()
const providers = []

if (githubClientId && githubClientSecret) {
  providers.push(
    GithubProvider({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    })
  )
}

/** @type {import('next-auth').NextAuthOptions} */
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub
      }

      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
