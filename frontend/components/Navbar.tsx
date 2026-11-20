'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useAuth } from '@clerk/nextjs'
import { ArrowUpRight } from 'lucide-react'

// Signed-out visitors get the marketing links, signed-in users get the app.
const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#how', label: 'How it works' },
  { href: '/#method', label: 'Methodology' },
]
const APP_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/upload', label: 'Upload' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/compare', label: 'Compare' },
]

function Mark() {
  // Eight-spoke mark, a nod to the wheel on the national emblem, drawn as simple petals.
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="11" y="2" width="2" height="8" rx="1" fill="var(--signal)" transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  )
}

export default function Navbar() {
  const { isSignedIn } = useAuth()
  const pathname = usePathname()
  const links = isSignedIn ? APP_LINKS : PUBLIC_LINKS
  // The landing page is a narrow column, the app pages are wide.
  const width = pathname === '/' ? 'ps-nav' : 'max-w-[1320px] px-5 lg:px-10'

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-[#e7e7e1]">
      <nav className={`${width} mx-auto py-3 md:h-[70px] md:py-0 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2`}>
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold text-[#23242b]">
          <Mark />
          PolicySim
        </Link>

        <ul className="order-3 md:order-none col-span-2 md:col-span-1 flex items-center gap-7 overflow-x-auto no-scrollbar text-xs">
          {links.map((link) => {
            const active = !link.href.includes('#') && (link.href === '/' ? pathname === '/' : pathname.startsWith(link.href))
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap transition-colors ${
                    active ? 'font-semibold text-[#23242b]' : 'text-[#80828b] hover:text-[#23242b]'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="justify-self-end flex items-center gap-5 text-xs font-medium">
          {isSignedIn ? (
            <UserButton />
          ) : (
            <>
              <Link href="/sign-in" className="hidden sm:inline text-[#23242b]">
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-[9px] bg-[#23242b] px-4 py-3 text-xs font-semibold text-white transition-transform hover:-translate-y-px"
              >
                Create account <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}