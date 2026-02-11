import type { ReactNode } from 'react'

type BadgeProps = {
  label: string
  variant?: 'default' | 'ember' | 'glow' | 'danger' | 'gold'
  icon?: ReactNode
  size?: 'sm' | 'md'
}

const variantStyles = {
  default: 'border-ink/12 text-ink-muted bg-surface/60',
  ember: 'border-ember/25 text-ember bg-ember/8',
  glow: 'border-glow/25 text-glow bg-glow/8',
  danger: 'border-crimson/25 text-crimson bg-crimson/8',
  gold: 'border-gold/25 text-gold bg-gold/10',
}

export function Badge({ label, variant = 'default', icon, size = 'md' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold uppercase tracking-wider ${variantStyles[variant]} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[8px]' : 'px-2.5 py-1 text-[10px]'
      }`}
    >
      {icon ? <span className="flex shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span> : null}
      {label}
    </span>
  )
}
