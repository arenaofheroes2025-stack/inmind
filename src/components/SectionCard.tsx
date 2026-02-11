import type { ReactNode } from 'react'

type SectionCardProps = {
  children: ReactNode
  className?: string
  glow?: 'glow' | 'ember' | 'gold' | 'none'
}

const glowMap = {
  glow: 'border-glow/15 shadow-[inset_0_1px_0_rgba(78,203,255,0.06),_0_0_12px_rgba(78,203,255,0.04)]',
  ember: 'border-ember/15 shadow-[inset_0_1px_0_rgba(255,107,53,0.06),_0_0_12px_rgba(255,107,53,0.04)]',
  gold: 'border-gold/18 shadow-[inset_0_1px_0_rgba(201,168,76,0.08),_0_0_12px_rgba(201,168,76,0.04)]',
  none: 'border-ink/10',
}

export function SectionCard({ children, className, glow = 'none' }: SectionCardProps) {
  return (
    <div
      className={`rounded-lg border bg-gradient-to-b from-surface/80 to-surface/40 p-4 ${glowMap[glow]} ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
