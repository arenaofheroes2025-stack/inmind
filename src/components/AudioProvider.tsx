import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'

/* ──────────────────────────────────────────────
   Routes where the main theme should play
   ────────────────────────────────────────────── */
const MUSIC_ROUTES = ['/', '/nova-aventura']

/* ──────────────────────────────────────────────
   Context shape
   ────────────────────────────────────────────── */
interface AudioContextValue {
  /** Whether the music is currently playing */
  isPlaying: boolean
  /** Current volume 0–1 */
  volume: number
  /** Whether music is enabled on supported routes */
  enabled: boolean
  /** Toggle play / pause */
  toggle: () => void
  /** Set volume (0–1) */
  setVolume: (v: number) => void
}

const AudioCtx = createContext<AudioContextValue>({
  isPlaying: false,
  volume: 0.3,
  enabled: false,
  toggle: () => {},
  setVolume: () => {},
})

export const useAudio = () => useContext(AudioCtx)

/* ──────────────────────────────────────────────
   Provider
   ────────────────────────────────────────────── */
const STORAGE_KEY = 'inmind_audio'

function loadPrefs(): { volume: number; muted: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { volume: 0.3, muted: false }
}

function savePrefs(volume: number, muted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume, muted }))
  } catch { /* ignore */ }
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const prefs = useRef(loadPrefs())
  const [volume, setVolumeState] = useState(prefs.current.volume)
  const [muted, setMuted] = useState(prefs.current.muted)
  const [isPlaying, setIsPlaying] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)

  // Determine if current route supports music
  const onMusicRoute = MUSIC_ROUTES.includes(location.pathname)

  // Create audio element once
  useEffect(() => {
    const audio = new Audio('/audios/main_theme.mp3')
    audio.loop = true
    audio.volume = prefs.current.volume
    audio.preload = 'auto'
    audioRef.current = audio

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Capture first user interaction to unlock autoplay
  useEffect(() => {
    if (userInteracted) return
    const unlock = () => setUserInteracted(true)
    const events = ['click', 'touchstart', 'keydown'] as const
    events.forEach((e) => document.addEventListener(e, unlock, { once: true }))
    return () => events.forEach((e) => document.removeEventListener(e, unlock))
  }, [userInteracted])

  // Play/pause based on route + mute state + user interaction
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (onMusicRoute && !muted && userInteracted) {
      audio.play().catch(() => { /* browser blocked — ignore */ })
    } else if (!onMusicRoute) {
      // Fade out when leaving music routes
      const fadeOut = () => {
        const step = 0.02
        const interval = setInterval(() => {
          if (audio.volume > step) {
            audio.volume = Math.max(0, audio.volume - step)
          } else {
            clearInterval(interval)
            audio.pause()
            audio.currentTime = 0
            audio.volume = volume // restore for next play
          }
        }, 30)
        return interval
      }
      if (!audio.paused) {
        const id = fadeOut()
        return () => clearInterval(id)
      }
    }
  }, [onMusicRoute, muted, userInteracted, volume])

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current && onMusicRoute) {
      audioRef.current.volume = volume
    }
  }, [volume, onMusicRoute])

  const toggle = useCallback(() => {
    const next = !muted
    setMuted(next)
    savePrefs(volume, next)

    const audio = audioRef.current
    if (!audio) return
    if (next) {
      audio.pause()
    } else if (onMusicRoute) {
      audio.volume = volume
      audio.play().catch(() => {})
    }
  }, [muted, volume, onMusicRoute])

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v))
      setVolumeState(clamped)
      savePrefs(clamped, muted)
      if (audioRef.current) {
        audioRef.current.volume = clamped
      }
    },
    [muted],
  )

  return (
    <AudioCtx.Provider
      value={{
        isPlaying,
        volume,
        enabled: onMusicRoute,
        toggle,
        setVolume,
      }}
    >
      {children}
    </AudioCtx.Provider>
  )
}
