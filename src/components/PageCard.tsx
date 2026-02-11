import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type PageCardProps = {
  children: ReactNode
  className?: string
  ornate?: boolean
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

export function PageCard({ children, className, ornate = false }: PageCardProps) {
  return (
    <motion.section
      {...fadeIn}
      className={`rpg-frame rpg-texture relative overflow-hidden rounded-frame bg-gradient-to-b from-panel to-panel/90 backdrop-blur-md ${className ?? ''}`}
    >
      {/* accent bar */}
      <div className="rpg-accent-bar bg-gradient-to-r from-transparent via-gold to-transparent" />
      {/* corner diamonds */}
      {ornate ? (
        <div className="rpg-corners">
          <span className="corner-tl" />
          <span className="corner-tr" />
          <span className="corner-bl" />
          <span className="corner-br" />
        </div>
      ) : null}
      {children}
    </motion.section>
  )
}
