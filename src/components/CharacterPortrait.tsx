type CharacterPortraitProps = {
  src?: string
  fallback?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'arch' | 'circle'
  className?: string
  /** Gold glow ring when selected/active */
  active?: boolean
}

const sizes = {
  xs: { arch: 'h-8 w-6', circle: 'h-8 w-8' },
  sm: { arch: 'h-16 w-12', circle: 'h-12 w-12' },
  md: { arch: 'h-24 w-[72px]', circle: 'h-20 w-20' },
  lg: { arch: 'h-40 w-[120px]', circle: 'h-32 w-32' },
}

export function CharacterPortrait({
  src,
  fallback,
  size = 'md',
  variant = 'arch',
  className,
  active = false,
}: CharacterPortraitProps) {
  const dim = sizes[size][variant]
  const frameClass = variant === 'arch' ? 'portrait-frame' : 'portrait-circle'

  /* For circle avatars with 9:16 portrait images, scale up and crop from top
     to zoom into the character's face */
  const objectFit = variant === 'circle'
    ? 'object-cover object-[center_9%] scale-[2.2] origin-top'
    : 'object-cover object-[center_11%] scale-[2.4] origin-top'

  return (
    <div
      className={`${frameClass} ${dim} shrink-0 ${
        active ? 'rpg-pulse ring-2 ring-gold/50 ring-offset-2 ring-offset-obsidian' : ''
      } ${className ?? ''}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className={`h-full w-full ${objectFit}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-panel-light to-panel">
          <span className="font-display text-gold/60" style={{ fontSize: size === 'lg' ? '2rem' : size === 'md' ? '1.25rem' : size === 'sm' ? '0.875rem' : '0.625rem' }}>
            {fallback ?? '?'}
          </span>
        </div>
      )}
    </div>
  )
}
