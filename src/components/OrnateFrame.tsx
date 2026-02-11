import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type OrnateFrameProps = {
  children: ReactNode
  className?: string
  /** Show diamond corner ornaments */
  corners?: boolean
  /** Accent color line at top */
  accent?: 'gold' | 'ember' | 'glow' | 'none'
  /** Animate on mount */
  animate?: boolean
}

const accentGradients = {
  gold: 'from-transparent via-gold to-transparent',
  ember: 'from-transparent via-ember to-transparent',
  glow: 'from-transparent via-glow to-transparent',
  none: '',
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

export function OrnateFrame({
  children,
  className,
  corners = true,
  accent = 'gold',
  animate = true,
}: OrnateFrameProps) {
  const Wrapper = animate ? motion.section : 'section'
  const wrapperProps = animate ? fadeIn : {}

  return (
    <Wrapper
      {...wrapperProps}
      className={`rpg-frame rpg-texture relative overflow-hidden rounded-frame bg-gradient-to-b from-panel to-panel/90 backdrop-blur-md ${className ?? ''}`}
    >
      {/* accent bar */}
      {accent !== 'none' ? (
        <div className={`rpg-accent-bar bg-gradient-to-r ${accentGradients[accent]}`} />
      ) : null}

      {/* inner border line */}
      {/* already via .rpg-frame::before */}

      {/* corner diamonds */}
      {corners ? (
        <div className="rpg-corners">
          <span className="corner-tl" />
          <span className="corner-tr" />
          <span className="corner-bl" />
          <span className="corner-br" />
        </div>
      ) : null}

      {children}
    </Wrapper>
  )
}
