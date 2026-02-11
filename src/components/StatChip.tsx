import type { ReactNode } from 'react'

type StatChipProps = {
  icon: ReactNode
  value: string | number
  label?: string
  color?: 'gold' | 'ember' | 'glow' | 'crimson' | 'arcane' | 'default'
}

const colorStyles = {
  gold:    'border-gold/20 bg-gold/8 text-gold',
  ember:   'border-ember/20 bg-ember/8 text-ember',
  glow:    'border-glow/20 bg-glow/8 text-glow',
  crimson: 'border-crimson/20 bg-crimson/8 text-crimson',
  arcane:  'border-arcane/20 bg-arcane/8 text-arcane',
  default: 'border-ink/12 bg-ink/5 text-ink',
}

export function StatChip({ icon, value, label, color = 'default' }: StatChipProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${colorStyles[color]}`}>
      <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      <span className="text-xs font-bold tabular-nums">{value}</span>
      {label ? <span className="text-[9px] uppercase tracking-wider opacity-70">{label}</span> : null}
    </div>
  )
}
