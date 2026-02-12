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
   Track definitions
   ────────────────────────────────────────────── */
type TrackId = 'menu' | 'adventure' | null

const TRACKS: Record<Exclude<TrackId, null>, { src: string; defaultVolume: number }> = {
  menu: { src: '/audios/main_theme.mp3', defaultVolume: 0.42 },
  adventure: { src: '/audios/nova_aventura.mp3', defaultVolume: 0.3 },
}

/** Determine which track should play based on current route */
function getTrackForRoute(pathname: string): TrackId {
  // Adventure gameplay — play adventure music
  if (pathname.match(/^\/aventura\/[^/]+\/jogar/)) return 'adventure'
  // All other screens (menu, new adventure, characters, blueprint, map) — play menu music
  return 'menu'
}

/* ──────────────────────────────────────────────
   Context shape
   ────────────────────────────────────────────── */
interface AudioContextValue {
  /** Whether the music is currently playing */
  isPlaying: boolean
  /** Current volume 0–1 */
  volume: number
  /** Whether music is enabled on current route */
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

interface SavedPrefs {
  volume: number
  muted: boolean
}

function loadPrefs(): SavedPrefs {
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

/** Fade out an audio element and pause it */
function fadeOutAudio(audio: HTMLAudioElement, targetVolume: number): number {
  const step = 0.02
  const interval = window.setInterval(() => {
    if (audio.volume > step) {
      audio.volume = Math.max(0, audio.volume - step)
    } else {
      clearInterval(interval)
      audio.pause()
      audio.currentTime = 0
      audio.volume = targetVolume // restore for next play
    }
  }, 30)
  return interval
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const location = useLocation()

  const prefs = useRef(loadPrefs())
  const [volume, setVolumeState] = useState(prefs.current.volume)
  const [muted, setMuted] = useState(prefs.current.muted)
  const [isPlaying, setIsPlaying] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)

  // Audio elements — one per track, created once
  const audiosRef = useRef<Record<string, HTMLAudioElement>>({})
  const activeTrackRef = useRef<TrackId>(null)
  const fadeIntervalRef = useRef<number | null>(null)

  const desiredTrack = getTrackForRoute(location.pathname)

  // Create audio elements once
  useEffect(() => {
    const map: Record<string, HTMLAudioElement> = {}
    for (const [id, cfg] of Object.entries(TRACKS)) {
      const audio = new Audio(cfg.src)
      audio.loop = true
      audio.volume = prefs.current.volume
      audio.preload = 'auto'
      map[id] = audio
    }
    audiosRef.current = map

    // Sync isPlaying state
    const handlers: Array<() => void> = []
    for (const audio of Object.values(map)) {
      const onPlay = () => setIsPlaying(true)
      const onPause = () => {
        // Only set false if no other track is playing
        const anyPlaying = Object.values(audiosRef.current).some((a) => !a.paused)
        if (!anyPlaying) setIsPlaying(false)
      }
      audio.addEventListener('play', onPlay)
      audio.addEventListener('pause', onPause)
      handlers.push(() => {
        audio.removeEventListener('play', onPlay)
        audio.removeEventListener('pause', onPause)
      })
    }

    return () => {
      handlers.forEach((h) => h())
      for (const audio of Object.values(map)) {
        audio.pause()
        audio.src = ''
      }
    }
  }, [])

  // Capture first user interaction to unlock autoplay
  useEffect(() => {
    if (userInteracted) return
    const unlock = () => {
      setUserInteracted(true)
      // Immediately try to play on unlock if on a music route
      const track = getTrackForRoute(window.location.pathname)
      if (track && !muted) {
        const audio = audiosRef.current[track]
        if (audio && audio.paused) {
          audio.volume = volume
          audio.play().catch(() => {})
        }
      }
    }
    const events = ['click', 'touchstart', 'keydown'] as const
    events.forEach((e) => document.addEventListener(e, unlock, { once: true }))
    return () => events.forEach((e) => document.removeEventListener(e, unlock))
  }, [userInteracted, muted, volume])

  // Switch tracks based on route
  useEffect(() => {
    const audios = audiosRef.current
    const prevTrack = activeTrackRef.current

    // Clear any pending fade
    if (fadeIntervalRef.current != null) {
      clearInterval(fadeIntervalRef.current)
      fadeIntervalRef.current = null
    }

    // If same track, just ensure it's playing (or paused if muted)
    if (desiredTrack === prevTrack) {
      if (desiredTrack && !muted && userInteracted) {
        const audio = audios[desiredTrack]
        if (audio && audio.paused) {
          audio.volume = volume
          audio.play().catch(() => {})
        }
      }
      return
    }

    // Fade out previous track
    if (prevTrack && audios[prevTrack] && !audios[prevTrack].paused) {
      fadeIntervalRef.current = fadeOutAudio(audios[prevTrack], volume)
    }

    // Start new track
    activeTrackRef.current = desiredTrack
    if (desiredTrack && !muted && userInteracted) {
      const audio = audios[desiredTrack]
      if (audio) {
        audio.volume = volume
        audio.play().catch(() => {})
      }
    }

    return () => {
      if (fadeIntervalRef.current != null) {
        clearInterval(fadeIntervalRef.current)
        fadeIntervalRef.current = null
      }
    }
  }, [desiredTrack, muted, userInteracted, volume])

  // Sync volume to active audio element
  useEffect(() => {
    if (desiredTrack) {
      const audio = audiosRef.current[desiredTrack]
      if (audio && !audio.paused) {
        audio.volume = volume
      }
    }
  }, [volume, desiredTrack])

  const toggle = useCallback(() => {
    const next = !muted
    setMuted(next)
    savePrefs(volume, next)

    if (desiredTrack) {
      const audio = audiosRef.current[desiredTrack]
      if (!audio) return
      if (next) {
        audio.pause()
      } else {
        audio.volume = volume
        audio.play().catch(() => {})
      }
    }
  }, [muted, volume, desiredTrack])

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v))
      setVolumeState(clamped)
      savePrefs(clamped, muted)
      // Apply to currently playing track
      if (desiredTrack) {
        const audio = audiosRef.current[desiredTrack]
        if (audio) audio.volume = clamped
      }
    },
    [muted, desiredTrack],
  )

  return (
    <AudioCtx.Provider
      value={{
        isPlaying,
        volume,
        enabled: desiredTrack !== null,
        toggle,
        setVolume,
      }}
    >
      {children}
    </AudioCtx.Provider>
  )
}
