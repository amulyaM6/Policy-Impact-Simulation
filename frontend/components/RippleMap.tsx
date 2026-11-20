'use client'

import type { CSSProperties } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { MAP_CENTERS, MAP_STATES, MAP_VIEWBOX } from '@/lib/indiaStates'

interface Props {
  /** State names that pulse red, in order. The first two also get a label. */
  hot: string[]
}

// Where each label sits relative to its state centre, in px.
const LABEL_OFFSETS: [number, number][] = [
  [-62, -34],
  [58, 2],
]

export default function RippleMap({ hot }: Props) {
  const hotIndex = new Map(hot.map((n, i) => [n, i]))

  return (
    <div className="ps-map">
      <svg viewBox={MAP_VIEWBOX} role="img" aria-label={`Map of India, most affected: ${hot.join(', ')}`}>
        <g stroke="#fff" strokeWidth="1.2" strokeLinejoin="round">
          {MAP_STATES.map((s) => {
            const i = hotIndex.get(s.name)
            return (
              <path
                key={s.name}
                d={s.d}
                className={`ps-region${i === undefined ? '' : ` ps-pulse ps-d${i}`}`}
                style={{ '--b': s.base } as CSSProperties}
              />
            )
          })}
        </g>
      </svg>

      {hot.map((name, i) => {
        const c = MAP_CENTERS[name]
        if (!c) return null
        return <span key={`r-${name}`} className={`ps-ripple ps-rd${i}`} style={{ left: `${c[0]}%`, top: `${c[1]}%` }} />
      })}

      {hot.slice(0, 2).map((name, i) => {
        const c = MAP_CENTERS[name]
        if (!c) return null
        const [dx, dy] = LABEL_OFFSETS[i]
        return (
          <span
            key={`t-${i}`}
            className="ps-tag"
            style={{ left: `${c[0]}%`, top: `${c[1]}%`, '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties}
          >
            {name}
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
          </span>
        )
      })}
    </div>
  )
}