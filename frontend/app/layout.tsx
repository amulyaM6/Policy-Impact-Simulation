import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { ClerkProvider } from '@clerk/nextjs'

// Inter, exposed under the existing --font-grotesk variable so globals.css keeps working.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-grotesk',
})

export const metadata: Metadata = {
  title: 'PolicySim – See the impact before it becomes law',
  description: 'See how a policy lands across India before it becomes law.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="font-sans bg-background text-foreground min-h-screen">
          <Navbar />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  )
}