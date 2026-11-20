'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine
} from 'recharts'
import { motion } from 'framer-motion'
import { TimelinePoint } from '@/lib/types'
import { Calendar, TrendingUp } from 'lucide-react'

export default function TimelineChart({ timeline }: { timeline: TimelinePoint[] }) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload
      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-3.5 max-w-xs space-y-1">
          <span className="text-brand-600 font-semibold text-xs block">{point.period}</span>
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 border-b border-slate-100 pb-1">
            <span>Projected Impact:</span>
            <span className={`text-sm ${point.impact_score > 70 ? 'text-brand-600' : point.impact_score > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {point.impact_score}/100
            </span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed pt-1">{point.description}</p>
        </div>
      )
    }
    return null
  }

  const maxScore = Math.max(...timeline.map(t => t.impact_score))
  const trend = maxScore > 70 ? 'Critical Projection' : maxScore > 40 ? 'Moderate Impact' : 'Low Impact Trajectory'
  const trendBadge = maxScore > 70 ? 'bg-brand-50 border-brand-200 text-brand-700' : maxScore > 40 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="card rounded-2xl p-6 mb-6 shadow-lg shadow-slate-900/5"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Multi-Year Impact Trajectory</h2>
            <p className="text-slate-400 text-xs font-medium">Predictive timeline modeling across implementation phases</p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${trendBadge} flex items-center gap-1.5`}>
          <TrendingUp className="w-3.5 h-3.5" />
          {trend}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#de4540" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#de4540" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#efedeb" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fill: '#9d9793', fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#9d9793', fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={70} stroke="#de4540" strokeDasharray="4 4" label={{ value: 'Critical (70+)', fill: '#de4540', fontSize: 10, fontWeight: 700 }} />
          <ReferenceLine y={40} stroke="#c98a1c" strokeDasharray="4 4" label={{ value: 'Moderate (40)', fill: '#c98a1c', fontSize: 10, fontWeight: 700 }} />
          <Area
            type="monotone"
            dataKey="impact_score"
            stroke="#de4540"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorImpact)"
            dot={{ fill: '#de4540', r: 5, strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 8, fill: '#de4540', stroke: '#ffffff', strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Timeline points summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5">
        {timeline.map((t, i) => (
          <div key={i} className="text-center bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5 transition-all hover:bg-white hover:shadow-xs">
            <p className="text-slate-400 text-[11px] font-bold mb-1">{t.period}</p>
            <p className={`text-base font-semibold ${t.impact_score > 70 ? 'text-brand-600' : t.impact_score > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {t.impact_score}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}