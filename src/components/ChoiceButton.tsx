import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ChoiceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  variant?: 'primary' | 'ghost' | 'danger' | 'glow' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

const variantStyles: Record<NonNullable<ChoiceButtonProps['variant']>, string> = {
  primary:
    'bg-gradient-to-r from-ember to-[#ff8c5a] text-obsidian shadow-[0_0_20px_rgba(255,107,53,0.2)] hover:shadow-[0_0_28px_rgba(255,107,53,0.35)] active:scale-[0.97]',
  ghost:
    'border border-gold/20 text-ink hover:border-gold/40 hover:bg-gold/5 active:scale-[0.97]',
  danger:
    'bg-gradient-to-r from-crimson to-red-600 text-white shadow-[0_0_20px_rgba(220,53,69,0.2)] hover:shadow-[0_0_28px_rgba(220,53,69,0.35)] active:scale-[0.97]',
  glow:
    'bg-gradient-to-r from-glow to-[#7be0ff] text-obsidian shadow-[0_0_20px_rgba(78,203,255,0.2)] hover:shadow-[0_0_28px_rgba(78,203,255,0.35)] active:scale-[0.97]',
  gold:
    'bg-gradient-to-r from-gold-dim via-gold to-gold-light text-obsidian font-bold shadow-[0_0_20px_rgba(201,168,76,0.2)] hover:shadow-[0_0_28px_rgba(201,168,76,0.35)] active:scale-[0.97]',
}

const sizeStyles: Record<NonNullable<ChoiceButtonProps['size']>, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm',
}

export function ChoiceButton({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  disabled,
  ...props
}: ChoiceButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? 'pointer-events-none opacity-35' : 'cursor-pointer'} ${className ?? ''}`}
      {...props}
    >
      {icon ? <span className="flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      {label}
    </button>
  )
}
