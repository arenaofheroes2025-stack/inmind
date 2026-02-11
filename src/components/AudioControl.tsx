import { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX, Minus, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAudio } from './AudioProvider'

/**
 * Small audio control button for the app header.
 * Shows a speaker icon; clicking opens a popover with play/pause + volume slider.
 * Only visible on routes where music is enabled.
 */
export function AudioControl() {
  const { isPlaying, volume, enabled, toggle, setVolume } = useAudio()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close popover on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  // Don't render on non-music routes
  if (!enabled) return null

  const volumePct = Math.round(volume * 100)

  const adjustVolume = (delta: number) => {
    setVolume(Math.round((volume + delta) * 100) / 100)
  }

  return (
    <div className="relative">
      {/* trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="group flex items-center justify-center rounded-full p-1.5 transition-colors hover:bg-gold/10"
        aria-label="Controle de áudio"
      >
        {isPlaying ? (
          <Volume2 className="h-4 w-4 text-gold-dim transition-colors group-hover:text-gold" />
        ) : (
          <VolumeX className="h-4 w-4 text-ink-muted transition-colors group-hover:text-gold-dim" />
        )}
      </button>

      {/* popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-[9998] mt-2 w-52 origin-top-right rounded-lg border border-gold/15 bg-panel/95 p-3 shadow-xl backdrop-blur-xl"
          >
            {/* play / pause */}
            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-gold/10"
            >
              {isPlaying ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-gold-dim" />
                  <span className="text-ink">Pausar música</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-gold-dim" />
                  <span className="text-ink">Tocar música</span>
                </>
              )}
            </button>

            {/* divider */}
            <div className="my-2 h-px bg-gold/10" />

            {/* volume control */}
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => adjustVolume(-0.1)}
                className="rounded p-0.5 transition-colors hover:bg-gold/10"
                aria-label="Diminuir volume"
              >
                <Minus className="h-3.5 w-3.5 text-gold-dim" />
              </button>

              {/* slider */}
              <div className="relative flex-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volumePct}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="audio-slider w-full"
                  style={{ '--val': volumePct } as React.CSSProperties}
                  aria-label="Volume"
                />
              </div>

              <button
                type="button"
                onClick={() => adjustVolume(0.1)}
                className="rounded p-0.5 transition-colors hover:bg-gold/10"
                aria-label="Aumentar volume"
              >
                <Plus className="h-3.5 w-3.5 text-gold-dim" />
              </button>

              <span className="min-w-[2ch] text-right text-xs tabular-nums text-gold-dim">
                {volumePct}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
