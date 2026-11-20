'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import FileUpload from '@/components/FileUpload'

const STEPS = [
  'Reading the document',
  'Scoring risk across four dimensions',
  'Running 10,000 Monte Carlo trials',
  'Mapping impact by state and sector',
]

export default function UploadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timeoutWarning, setTimeoutWarning] = useState(false)

  const handleUpload = async (file: File) => {
    setLoading(true)
    setError('')
    setTimeoutWarning(false)

    // Show warning after 15 seconds
    const warningTimer = setTimeout(() => {
      setTimeoutWarning(true)
    }, 45000)

    // Cancel everything after 60 seconds
    const controller = new AbortController()
    const timeoutTimer = setTimeout(() => {
      controller.abort()
    }, 180000)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/upload`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      localStorage.setItem('simulationResult', JSON.stringify(data))
      router.push('/dashboard')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('The analysis took longer than 3 minutes and was stopped. Try again, or upload a shorter document.')
      } else {
        setError('Couldn’t reach the analysis server. Check that the FastAPI backend is running on port 8000.')
      }
      setLoading(false)
    } finally {
      clearTimeout(warningTimer)
      clearTimeout(timeoutTimer)
    }
  }

  return (
    <div className="max-w-[1320px] mx-auto px-5 lg:px-10 pt-8 pb-20 grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
      <div className="lg:col-span-5 lg:sticky lg:top-28">
        <h1 className="display text-[clamp(2.75rem,5.6vw,5rem)]">Upload a policy</h1>
        <p className="mt-6 text-base text-slate-600 leading-relaxed max-w-md">
          We’ll read the document, score its risk and simulate how it plays out across India. Most documents take
          20–40 seconds.
        </p>
        <ol className="mt-10 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-4 text-sm text-slate-700">
              <span className="w-8 h-8 shrink-0 rounded-full bg-white border border-black/5 flex items-center justify-center text-xs text-slate-900">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="lg:col-span-7">
        {loading ? (
          <div className="card p-10 sm:p-14" aria-live="polite">
            <div className="flex items-center gap-4">
              <span className="relative w-10 h-10 shrink-0">
                <span className="absolute inset-0 rounded-full border-2 border-slate-200" />
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--signal)] animate-spin" />
              </span>
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-slate-900">Analysing your policy</h2>
                <p className="text-sm text-slate-600 mt-1">Running the simulation across 28 states and 5 sectors.</p>
              </div>
            </div>
            {timeoutWarning && (
              <p className="mt-6 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
                This document is taking longer than usual. Keep this page open; it will stop after 3 minutes.
              </p>
            )}
          </div>
        ) : (
          <>
            <FileUpload onUpload={handleUpload} disabled={loading} />
            {error && (
              <p role="alert" className="mt-5 card px-5 py-4 flex items-start gap-3 text-sm text-slate-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
