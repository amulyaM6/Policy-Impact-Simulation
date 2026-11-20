import type { Metadata } from 'next'
import { Schibsted_Grotesk } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { ClerkProvider } from '@clerk/nextjs'

const grotesk = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-grotesk',
})

export const metadata: Metadata = {
  title: 'PolicySim',
  description: 'See how a policy lands across India before it becomes law.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={grotesk.variable}>
        <body className="font-sans bg-background text-foreground min-h-screen">
          <Navbar />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  )
}
