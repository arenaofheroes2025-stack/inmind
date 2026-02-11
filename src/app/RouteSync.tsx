/**
 * RouteSync — syncs URL route params into Zustand store on mount.
 *
 * This allows the app to restore state when a user refreshes, follows a
 * bookmark, or uses the browser back/forward buttons. Each route wrapper
 * reads its URL params and writes them into the global store so existing
 * screen logic continues to work unchanged.
 */

import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useGameStore } from '../store/useGameStore'
import { getWorld, listCharactersByWorld } from '../services/cache'

/** Sync :worldId from URL → store (world object + characters) */
export function SyncWorldId() {
  const { worldId } = useParams<{ worldId: string }>()

  const setCurrentWorldId = useGameStore((s) => s.setCurrentWorldId)
  const setWorld = useGameStore((s) => s.setWorld)
  const setSavedCharacters = useGameStore((s) => s.setSavedCharacters)

  useEffect(() => {
    if (!worldId) return
    setCurrentWorldId(worldId)

    // If the store doesn't already have this world loaded, fetch from IndexedDB
    const storeWorld = useGameStore.getState().world
    if (!storeWorld || storeWorld.id !== worldId) {
      let mounted = true
      ;(async () => {
        const [w, chars] = await Promise.all([
          getWorld(worldId),
          listCharactersByWorld(worldId),
        ])
        if (!mounted) return
        if (w) setWorld(w)
        setSavedCharacters(chars)
      })()
      return () => { mounted = false }
    }
  }, [worldId, setCurrentWorldId, setWorld, setSavedCharacters])

  return null
}

/** Sync :charId from URL → store.editingCharacterId (for edit mode) */
export function SyncEditingCharId() {
  const { charId } = useParams<{ charId: string }>()
  const setEditingCharacterId = useGameStore((s) => s.setEditingCharacterId)

  useEffect(() => {
    if (charId) {
      setEditingCharacterId(charId)
    }
  }, [charId, setEditingCharacterId])

  return null
}

/** Clear editingCharacterId when entering "new character" route */
export function SyncNewCharacter() {
  const setEditingCharacterId = useGameStore((s) => s.setEditingCharacterId)

  useEffect(() => {
    setEditingCharacterId(null)
  }, [setEditingCharacterId])

  return null
}
