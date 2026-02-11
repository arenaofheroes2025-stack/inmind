import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type FullscreenCinematicProps = {
  /** Whether the parent considers loading done — cinematic stays open for at least `minDuration` ms even if true early */
  open: boolean
  /** Primary label shown over the video, e.g. "Entrando no mundo..." */
  label?: string
  /** Optional secondary label, e.g. location name */
  sublabel?: string
  /** Optional image URL of the destination (location artwork) */
  imageUrl?: string
  /** Minimum time (ms) the cinematic stays visible, even if content loads instantly. Default 6000 */
  minDuration?: number
  /** Maximum time (ms) before force-closing, even if still loading. Default 60000 (1 min) */
  maxDuration?: number
}

/**
 * Full-screen video overlay used during world entry and location travel.
 * Covers the entire viewport, plays a looping cinematic video, and shows
 * immersive text. Enforces a minimum display time so the transition never
 * feels abrupt.
 */
export function FullscreenCinematic({
  open,
  label = 'Entrando no mundo...',
  sublabel,
  imageUrl,
  minDuration = 6000,
  maxDuration = 60000,
}: FullscreenCinematicProps) {
  const [visible, setVisible] = useState(false)
  const openedAtRef = useRef<number>(0)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Force-close safety net
  useEffect(() => {
    if (visible) {
      maxTimerRef.current = setTimeout(() => setVisible(false), maxDuration)
      return () => clearTimeout(maxTimerRef.current)
    }
  }, [visible, maxDuration])

  useEffect(() => {
    if (open) {
      // Opening — show immediately
      openedAtRef.current = Date.now()
      setVisible(true)
    } else if (visible) {
      // Closing — enforce minimum duration
      const elapsed = Date.now() - openedAtRef.current
      const remaining = Math.max(0, minDuration - elapsed)
      const timer = setTimeout(() => setVisible(false), remaining)
      return () => clearTimeout(timer)
    }
  }, [open, minDuration]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="fullscreen-cinematic"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ touchAction: 'none', userSelect: 'none' }}
        >
          {/* video background – covers entire screen */}
          <video
            src="/videos/Enter_in_world.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* dark vignette overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/60 pointer-events-none" />

          {/* content – centered text */}
          <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
            {/* ornamental top line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
              className="h-px w-32 bg-gradient-to-r from-transparent via-gold/50 to-transparent"
            />

            {/* main label */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              className="font-display text-2xl font-bold tracking-wide text-gold sm:text-3xl md:text-4xl"
              style={{ textShadow: '0 2px 24px rgba(0,0,0,0.8), 0 0 60px rgba(201,168,76,0.15)' }}
            >
              {label}
            </motion.p>

            {/* destination image – banner format */}
            {imageUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative w-[85vw] max-w-2xl sm:w-[70vw] md:w-[50vw] lg:w-[40vw]"
              >
                {/* outer glow */}
                <div className="absolute -inset-3 rounded-xl bg-gold/8 blur-2xl" />
                {/* frame */}
                <div className="relative overflow-hidden rounded-xl border border-gold/25 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
                  {/* corner ornaments */}
                  <div className="absolute left-1.5 top-1.5 z-10 h-4 w-4 border-l-2 border-t-2 border-gold/40 rounded-tl-sm" />
                  <div className="absolute right-1.5 top-1.5 z-10 h-4 w-4 border-r-2 border-t-2 border-gold/40 rounded-tr-sm" />
                  <div className="absolute left-1.5 bottom-1.5 z-10 h-4 w-4 border-l-2 border-b-2 border-gold/40 rounded-bl-sm" />
                  <div className="absolute right-1.5 bottom-1.5 z-10 h-4 w-4 border-r-2 border-b-2 border-gold/40 rounded-br-sm" />
                  {/* top gold line */}
                  <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                  {/* bottom gold line */}
                  <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                  <img
                    src={imageUrl}
                    alt=""
                    className="w-full object-cover"
                    style={{ aspectRatio: '21/9' }}
                  />
                  {/* edge gradient fade – left */}
                  <div className="absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-black/50 to-transparent" />
                  {/* edge gradient fade – right */}
                  <div className="absolute inset-y-0 right-0 w-1/5 bg-gradient-to-l from-black/50 to-transparent" />
                  {/* bottom gradient fade */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
              </motion.div>
            )}

            {/* sub-label (location name, etc.) */}
            {sublabel && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="max-w-md text-sm leading-relaxed text-gold-dim/80 sm:text-base"
                style={{ textShadow: '0 1px 16px rgba(0,0,0,0.7)' }}
              >
                {sublabel}
              </motion.p>
            )}

            {/* ornamental bottom line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
              className="h-px w-32 bg-gradient-to-r from-transparent via-gold/50 to-transparent"
            />

            {/* loading spinner */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              className="flex items-center gap-2.5"
            >
              <div
                className="h-4 w-4 rounded-full border-2 border-gold/30 border-t-gold animate-spin"
                style={{ animationDuration: '2s' }}
              />
              <p className="text-xs tracking-wider text-gold/60 uppercase">
                Preparando
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
