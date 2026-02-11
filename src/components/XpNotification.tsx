import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export type XpEvent = {
  id: string
  characterName: string
  xpGained: number
}

type Props = {
  events: XpEvent[]
  onDone: (id: string) => void
}

/**
 * Floating push-notification-style toast that shows "+X EXP" per character.
 * Auto-dismisses after 2.5 seconds.
 */
export function XpNotification({ events, onDone }: Props) {
  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[120] flex flex-col items-end gap-2">
      <AnimatePresence mode="popLayout">
        {events.map((ev) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, mass: 1 }}
            onAnimationComplete={(def) => {
              // Auto-dismiss after entering
              if ((def as { opacity: number }).opacity === 1) {
                setTimeout(() => onDone(ev.id), 2500)
              }
            }}
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-gold/30 bg-gradient-to-r from-gold/15 via-panel to-panel px-4 py-2.5 shadow-[0_0_24px_rgba(201,168,76,0.2)]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/20">
              <Sparkles className="h-4 w-4 text-gold" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-gold-dim">
                {ev.characterName}
              </span>
              <span className="font-display text-lg font-bold tracking-wide text-gold">
                +{ev.xpGained} EXP
              </span>
            </div>
            {/* shimmer effect */}
            <motion.div
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-gold/10 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
