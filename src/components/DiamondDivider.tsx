type DiamondDividerProps = {
  label?: string
  className?: string
}

export function DiamondDivider({ label, className }: DiamondDividerProps) {
  return (
    <div className={`rpg-divider ${className ?? ''}`}>
      {label ? <span className="font-display text-[9px] uppercase tracking-[0.3em]">{label}</span> : '◆'}
    </div>
  )
}
