'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useAuth } from '@clerk/nextjs'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/upload', label: 'Upload' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/compare', label: 'Compare' },
]

function Mark() {
  // Eight-spoke mark, a nod to the wheel on the national emblem, drawn as simple petals.
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="11" y="2" width="2" height="8" rx="1" fill="var(--signal)" transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  )
}

export default function Navbar() {
  const { isSignedIn } = useAuth()
  const pathname = usePathname()

  const links = isSignedIn ? NAV_LINKS : NAV_LINKS.slice(0, 1)

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
      <nav className="max-w-[1320px] mx-auto px-5 lg:px-10 py-3 md:h-20 md:py-0 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2">
        <ul className="order-3 md:order-none col-span-2 md:col-span-1 flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1">
          {links.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block px-4 py-2 rounded-xl text-sm transition-colors ${
                    active ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(31,26,26,0.06)]' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <Link href="/" className="flex items-center gap-2.5 md:justify-self-center">
          <Mark />
          <span className="text-lg font-medium tracking-tight text-slate-900">PolicySim</span>
        </Link>

        <div className="justify-self-end flex items-center gap-3">
          {isSignedIn ? (
            <UserButton />
          ) : (
            <>
              <Link href="/sign-in" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900 px-2">
                Log in
              </Link>
              <Link href="/sign-up" className="btn btn-ink h-11">
                Create account
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}