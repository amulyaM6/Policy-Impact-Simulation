'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { SimulationResult } from '@/lib/types'
import jsPDF from 'jspdf'
import { Download, CheckCircle, Loader2 } from 'lucide-react'

export default function ExportButton({ data }: { data: SimulationResult }) {
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)

  const handleExport = () => {
    setExporting(true)
    setTimeout(() => {
      try {
        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.getWidth()
        let y = 20

        // Header
        doc.setFillColor(15, 23, 42)
        doc.rect(0, 0, pageWidth, 40, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(20)
        doc.setFont('helvetica', 'bold')
        doc.text('PolicySim — Executive Intelligence Report', 14, 25)

        y = 55

        // Policy Title
        doc.setTextColor(30, 30, 30)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(data.policy_title, 14, y)
        y += 10

        // Simulation ID
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text(`Simulation ID: ${data.id}`, 14, y)
        y += 15

        // Risk Score
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        doc.text('Overall Risk Score', 14, y)
        y += 8

        const riskColor = data.overall_risk_score > 70
          ? [239, 68, 68]
          : data.overall_risk_score > 40
          ? [234, 179, 8]
          : [34, 197, 94]

        doc.setFillColor(riskColor[0], riskColor[1], riskColor[2])
        doc.roundedRect(14, y, 40, 14, 3, 3, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`${data.overall_risk_score} / 100`, 22, y + 9)
        y += 25

        // Sector Scores
        doc.setTextColor(30, 30, 30)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Sector Impact Scores', 14, y)
        y += 8

        data.sectors.forEach((s) => {
          const unrated = s.method === 'unavailable'
          const barColor = unrated
            ? [214, 211, 209]
            : s.sentiment === 'positive'
            ? [47, 143, 91]
            : s.sentiment === 'negative'
            ? [222, 69, 64]
            : [148, 163, 184]
          const signed = s.signed_impact ?? (s.sentiment === 'negative' ? -s.score : s.score)
        })

        y += 5

        // Save PDF
        doc.save(`${data.policy_title.replace(/\s+/g, '_')}_analysis.pdf`)
        setDone(true)
        setTimeout(() => setDone(false), 2500)
      } catch (err) {
        console.error(err)
      } finally {
        setExporting(false)
      }
    }, 400)
  }

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={handleExport}
      disabled={exporting}
      className="btn btn-plain disabled:opacity-60"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin " />
      ) : done ? (
        <CheckCircle className="w-4 h-4 " />
      ) : (
        <Download className="w-4 h-4 " />
      )}
      <span>{exporting ? 'Generating PDF...' : done ? 'Downloaded!' : 'Export PDF Report'}</span>
    </motion.button>
  )
}