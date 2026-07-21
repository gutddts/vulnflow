import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({ code, language = 'text', className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToClipboard(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('relative rounded-lg border border-[#1e293b] bg-[#0d1321]', className)}>
      <div className="flex items-center justify-between border-b border-[#1e293b] px-4 py-2">
        <span className="text-xs text-[#00d4aa] font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-[#94a3b8] hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              复制
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm text-[#e2e8f0] font-mono leading-relaxed">{code}</code>
      </pre>
    </div>
  )
}
