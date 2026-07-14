import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      email: string
      image?: string | null
      name?: string | null
    }
  }
}

// Tell TypeScript to treat CSS imports as modules (no error on import './globals.css')
declare module '*.css' {
  const content: Record<string, string>
  export default content
}