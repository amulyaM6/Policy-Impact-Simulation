'use client'

import { INDIA_PATHS, INDIA_VIEWBOX } from '@/lib/indiaPaths'

// The bundled geojson predates a few renames and the Telangana split.
const ALIASES: Record<string, string> = {
  Telangana: 'Andhra Pradesh',
  Odisha: 'Orissa',
  Uttarakhand: 'Uttaranchal',
}

interface Props {
  /** State name → impact score (0–100). Listed states are drawn in signal red. */
  highlights?: { name: string; score: number }[]
  className?: string
}

export default function IndiaSilhouette({ highlights = [], className = '' }: Props) {
  const scoreByName = new Map(highlights.map((h) => [ALIASES[h.name] ?? h.name, h.score]))

  return (
    <svg viewBox={INDIA_VIEWBOX} className={className} role="img" aria-label="Map of India with the most affected states highlighted">
      <defs>
        <radialGradient id="stone" gradientUnits="userSpaceOnUse" cx="170" cy="120" r="640">
          <stop offset="0%" stopColor="#f4f2f0" />
          <stop offset="35%" stopColor="#aaa39f" />
          <stop offset="70%" stopColor="#5c5653" />
          <stop offset="100%" stopColor="#2e2928" />
        </radialGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.62" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="fade-mask">
          <rect width="100%" height="100%" fill="url(#fade)" />
        </mask>
        <filter id="lift" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#1f1a1a" floodOpacity="0.22" />
        </filter>
      </defs>

      <g mask="url(#fade-mask)" filter="url(#lift)">
        {INDIA_PATHS.map((p) => (
          <path key={p.name} d={p.d} fill="url(#stone)" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.8" strokeLinejoin="round" />
        ))}
        {INDIA_PATHS.filter((p) => scoreByName.has(p.name)).map((p) => {
          const score = scoreByName.get(p.name) ?? 0
          return (
            <path
              key={`hl-${p.name}`}
              d={p.d}
              fill="var(--signal)"
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeLinejoin="round"
              opacity={0.35 + (score / 100) * 0.6}
              className="fade-in"
            >
              <title>{`${p.name}: ${score}/100`}</title>
            </path>
          )
        })}
      </g>
    </svg>
  )
}
