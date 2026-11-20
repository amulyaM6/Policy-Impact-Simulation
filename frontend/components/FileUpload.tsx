'use client'

import { useState } from 'react'
import { FileUp, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function FileUpload({ onUpload, disabled }: { onUpload: (file: File) => void; disabled?: boolean }) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]

  const handleFile = (file: File) => {
    if (disabled) return

    if (!validTypes.includes(file.type)) {
      setError('That file type isn’t supported. Upload a PDF, DOCX or TXT file.')
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError('That file is over 10 MB. Upload a smaller file or split the document.')
      return
    }

    setError('')
    setSelectedFile(file)
    onUpload(file)
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
        className={`card relative p-10 sm:p-14 text-center transition-colors ${
          disabled ? 'opacity-70' : dragOver ? 'outline-2 outline-dashed outline-[var(--signal)] outline-offset-[-10px] bg-brand-50' : ''
        }`}
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-900 mb-6">
          {selectedFile ? <CheckCircle2 className="w-7 h-7 text-emerald-600" /> : <FileUp className="w-7 h-7" />}
        </div>

        <h2 className="text-2xl font-medium tracking-tight text-slate-900">
          {dragOver ? 'Drop to upload' : selectedFile ? selectedFile.name : 'Drop your policy document here'}
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
          PDF, DOCX or TXT, up to 10 MB. A draft bill, white paper or notification all work.
        </p>

        <label className={`btn btn-ink mt-7 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          Choose a file
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.txt"
            disabled={disabled}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 flex items-center justify-center gap-2 text-sm text-brand-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
