import type { ReactNode } from 'react'

type HPBarProps = {
  value: number
  max: number
  label?: string
  icon?: ReactNode
  color?: 'glow' | 'ember' | 'gold' | 'crimson' | 'arcane'
  showValue?: boolean
  size?: 'sm' | 'md'
}

const colorMap = {
  glow:    { fill: 'bg-gradient-to-r from-glow/70 to-glow', text: 'text-glow' },
  ember:   { fill: 'bg-gradient-to-r from-ember/70 to-ember', text: 'text-ember' },
  gold:    { fill: 'bg-gradient-to-r from-gold/70 to-gold', text: 'text-gold' },
  crimson: { fill: 'bg-gradient-to-r from-crimson/70 to-crimson', text: 'text-crimson' },
  arcane:  { fill: 'bg-gradient-to-r from-arcane/70 to-arcane', text: 'text-arcane' },
}

export function HPBar({
  value,
  max,
  label,
  icon,
  color = 'glow',
  showValue = true,
  size = 'md',
}: HPBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const c = colorMap[color]
  const h = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="w-full">
      {(label || showValue) ? (
        <div className="mb-1 flex items-center justify-between">
          {label ? (
            <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${c.text}`}>
              {icon ? <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span> : null}
              {label}
            </span>
          ) : null}
          {showValue ? (
            <span className="text-[10px] font-bold tabular-nums text-ink">
              {value}<span className="text-ink-muted">/{max}</span>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={`rpg-bar-track ${h}`}>
        <div
          className={`rpg-bar-fill ${c.fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
