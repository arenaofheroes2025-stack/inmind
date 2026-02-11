import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

type StatBarProps = {
  label: string
  value: number
  max: number
  color?: 'glow' | 'ember' | 'gold'
  description?: string
  icon?: ReactNode
  onIncrement?: () => void
  onDecrement?: () => void
  disableIncrement?: boolean
  disableDecrement?: boolean
}

const colorMap = {
  glow: {
    bar: 'bg-gradient-to-r from-glow/60 to-glow',
    bg: 'bg-glow/8',
    text: 'text-glow',
    icon: 'text-glow/60',
    btnActive: 'border-glow/25 hover:border-glow/40 hover:bg-glow/8',
  },
  ember: {
    bar: 'bg-gradient-to-r from-ember/60 to-ember',
    bg: 'bg-ember/8',
    text: 'text-ember',
    icon: 'text-ember/60',
    btnActive: 'border-ember/25 hover:border-ember/40 hover:bg-ember/8',
  },
  gold: {
    bar: 'bg-gradient-to-r from-gold/60 to-gold',
    bg: 'bg-gold/8',
    text: 'text-gold',
    icon: 'text-gold/60',
    btnActive: 'border-gold/25 hover:border-gold/40 hover:bg-gold/8',
  },
}

export function StatBar({
  label,
  value,
  max,
  color = 'glow',
  description,
  icon,
  onIncrement,
  onDecrement,
  disableIncrement,
  disableDecrement,
}: StatBarProps) {
  const pct = Math.min(100, (value / max) * 100)
  const c = colorMap[color]

  return (
    <div className="group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className={`flex shrink-0 [&>svg]:h-4 [&>svg]:w-4 ${c.icon}`}>{icon}</span>
          ) : null}
          <span className="text-xs font-medium text-ink">{label}</span>
          <span className={`min-w-[1.5ch] text-center text-xs font-bold tabular-nums ${c.text}`}>{value}</span>
        </div>

        {onIncrement || onDecrement ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onDecrement}
              disabled={disableDecrement}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-ink transition ${c.btnActive} disabled:pointer-events-none disabled:opacity-25`}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onIncrement}
              disabled={disableIncrement}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-ink transition ${c.btnActive} disabled:pointer-events-none disabled:opacity-25`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* bar */}
      <div className="rpg-bar-track mt-1.5">
        <div
          className={`rpg-bar-fill ${c.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {description ? (
        <p className="mt-1 text-[10px] leading-tight text-ink-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {description}
        </p>
      ) : null}
    </div>
  )
}
