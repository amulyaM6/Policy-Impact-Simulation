'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { motion } from 'framer-motion'
import { SectorScore } from '@/lib/types'
import { BarChart3, CheckCircle2, AlertCircle } from 'lucide-react'

export default function SectorChart({ sectors }: { sectors: SectorScore[] }) {
  // green = helps, red = harms, grey = negligible, light grey = not rated
  const BAR = { positive: '#2f8f5b', negative: '#de4540', neutral: '#94a3b8', unrated: '#d6d3d1' }

  // Signed value drives the bar: negative goes left, positive goes right.
  // Old results / demo data without signed_impact are rebuilt from sentiment.
  const rows = sectors.map((s) => {
    const unrated = s.method === 'unavailable'
    const signed = unrated
      ? 0
      : s.signed_impact ?? (s.sentiment === 'negative' ? -s.score : s.score)
    const kind = unrated ? 'unrated' : s.sentiment === 'positive' || s.sentiment === 'negative' ? s.sentiment : 'neutral'
    return { ...s, signed, kind }
  })

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const grounded = data.data_grounded
      const signed: number = data.signed
      const unrated = data.kind === 'unrated'

      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-xl p-3.5 text-xs max-w-xs space-y-1.5">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
            <span className="font-bold text-slate-900 text-sm">{data.name}</span>
            <span className={`capitalize font-bold px-2 py-0.5 rounded-full text-[10px] ${
              data.kind === 'positive' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              data.kind === 'negative' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {unrated ? 'not rated' : data.kind}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>Net impact:</span>
            <span className="font-semibold text-slate-900 text-sm">
              {unrated ? '–' : `${signed > 0 ? '+' : ''}${signed}`} <span className="text-slate-400 font-normal">(-100 to +100)</span>
            </span>
          </div>
          {grounded !== undefined && (
            <div className={`flex items-center gap-1.5 text-[11px] pt-1 font-medium ${grounded ? 'text-emerald-700' : 'text-amber-700'}`}>
              {grounded ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <span>{grounded
                  ? data.state_data_basis === 'proxy' ? 'National dataset only (state split is a proxy)' : 'Grounded with Government Datasets'
                  : 'AI Synthetic Estimation'}</span>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="card rounded-2xl p-6 h-full shadow-lg shadow-slate-900/5 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Sector Impact Breakdown</h2>
            <p className="text-slate-400 text-xs font-medium">Multi-sector algorithmic projection</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold">
          <span className="flex items-center gap-1 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" />Positive</span>
          <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-slate-400" />Neutral</span>
          <span className="flex items-center gap-1 text-brand-700"><span className="w-2 h-2 rounded-full bg-brand-500" />Negative</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={rows} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" domain={[-100, 100]} ticks={[-100, -50, 0, 50, 100]}
            tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
            tick={{ fill: '#9d9793', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#2e2928', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(222, 69, 64, 0.04)', rx: 8 }} />
          <ReferenceLine x={0} stroke="#cfc9c6" />
          <Bar dataKey="signed" radius={4} maxBarSize={22} minPointSize={2}>
            {rows.map((s, i) => (
              <Cell key={i} fill={BAR[s.kind as keyof typeof BAR]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}