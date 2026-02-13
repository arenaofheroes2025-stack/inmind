import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { narrateText, stopNarration, playAudioBlob, audioKeyFromText, type NarrationStatus } from '../services/narrationVoice'
import { getNarrationAudio, saveNarrationAudio } from '../services/cache'

type Props = {
  /** The text to narrate */
  text: string
  /** Whether narration should auto-start when text appears */
  autoPlay?: boolean
  /** Size variant */
  size?: 'sm' | 'md'
  /** Called when narration finishes playing (or errors) */
  onComplete?: () => void
}

/** Shared callbacks builder — checks cache first, falls back to API, saves to cache */
function startNarration(
  text: string,
  setStatus: (s: NarrationStatus) => void,
  onComplete: (() => void) | undefined,
  cleanupRef: React.MutableRefObject<(() => void) | null>,
) {
  const key = audioKeyFromText(text)

  getNarrationAudio(key)
    .then((cachedBlob) => {
      if (cachedBlob) {
        console.log('[NarrationButton] Reproduzindo áudio do cache:', key)
        const cleanup = playAudioBlob(cachedBlob, {
          onStatusChange: setStatus,
          onError: (err) => { console.warn('[NarrationButton]', err); onComplete?.() },
          onComplete: () => { setStatus('idle'); onComplete?.() },
        })
        cleanupRef.current = cleanup
      } else {
        const cleanup = narrateText(text, {
          onStatusChange: setStatus,
          onError: (err) => { console.warn('[NarrationButton]', err); onComplete?.() },
          onComplete: () => { setStatus('idle'); onComplete?.() },
          onAudioReady: (blob) => {
            saveNarrationAudio(key, blob).catch(() => {})
            console.log('[NarrationButton] Áudio salvo no cache:', key)
          },
        })
        cleanupRef.current = cleanup
      }
    })
    .catch(() => {
      // IndexedDB error — just generate fresh
      const cleanup = narrateText(text, {
        onStatusChange: setStatus,
        onError: (err) => { console.warn('[NarrationButton]', err); onComplete?.() },
        onComplete: () => { setStatus('idle'); onComplete?.() },
        onAudioReady: (blob) => { saveNarrationAudio(key, blob).catch(() => {}) },
      })
      cleanupRef.current = cleanup
    })
}

/**
 * A small button that triggers voice narration for a given text.
 * Checks the audio cache first — if the text was narrated before, replays
 * the cached WAV instantly without calling the API (saving prompt costs).
 */
export function NarrationButton({ text, autoPlay = false, size = 'sm', onComplete }: Props) {
  const [status, setStatus] = useState<NarrationStatus>('idle')
  const cleanupRef = useRef<(() => void) | null>(null)
  const autoPlayedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const handleNarrate = useCallback(() => {
    if (status === 'speaking' || status === 'connecting') {
      stopNarration()
      setStatus('idle')
      cleanupRef.current = null
      onCompleteRef.current?.()
      return
    }

    startNarration(text, setStatus, onCompleteRef.current, cleanupRef)
  }, [text, status])

  // Auto-play on first mount if enabled
  useEffect(() => {
    if (autoPlay && text && !autoPlayedRef.current) {
      autoPlayedRef.current = true
      const t = setTimeout(() => {
        startNarration(text, setStatus, onCompleteRef.current, cleanupRef)
      }, 500)
      return () => clearTimeout(t)
    }
  }, [autoPlay, text])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [])

  // Reset autoplay ref when text changes
  useEffect(() => {
    autoPlayedRef.current = false
  }, [text])

  const isBusy = status === 'connecting' || status === 'speaking'
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'

  return (
    <button
      type="button"
      onClick={handleNarrate}
      className={`group relative inline-flex ${btnSize} items-center justify-center rounded-full border transition-all ${
        isBusy
          ? 'border-gold/40 bg-gold/15 text-gold shadow-[0_0_12px_rgba(201,168,76,0.2)]'
          : status === 'error'
            ? 'border-ember/30 bg-ember/10 text-ember hover:border-ember/50'
            : 'border-gold/15 bg-gold/5 text-gold-dim hover:border-gold/30 hover:bg-gold/10 hover:text-gold'
      }`}
      title={isBusy ? 'Parar narração' : 'Ouvir narração'}
    >
      <AnimatePresence mode="wait">
        {status === 'connecting' ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            <Loader2 className={`${iconSize} animate-spin`} />
          </motion.div>
        ) : status === 'speaking' ? (
          <motion.div
            key="speaking"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            <Volume2 className={iconSize} />
            {/* pulsing ring while speaking */}
            <span className="absolute inset-0 animate-ping rounded-full border border-gold/30" />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            {status === 'error' ? (
              <VolumeX className={iconSize} />
            ) : (
              <Volume2 className={iconSize} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}
