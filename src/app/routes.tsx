/**
 * Route definitions and navigation helpers.
 *
 * These routes mirror the old `view` state but add URL-based navigation
 * so the browser back/forward buttons work and users can bookmark screens.
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/useGameStore'

/* ──────────────────────────────────────────────
   Route path constants
   ────────────────────────────────────────────── */

export const ROUTES = {
  /** Main menu — list saved worlds */
  MENU: '/',
  /** Create a new adventure (world wizard) */
  NEW_ADVENTURE: '/nova-aventura',
  /** Character hub — manage characters for a world */
  CHARACTERS: (worldId: string) => `/aventura/${worldId}`,
  /** Create a new character */
  NEW_CHARACTER: (worldId: string) => `/aventura/${worldId}/personagem/novo`,
  /** Edit an existing character */
  EDIT_CHARACTER: (worldId: string, charId: string) =>
    `/aventura/${worldId}/personagem/${charId}`,
  /** World map / blueprint */
  MAP: (worldId: string) => `/aventura/${worldId}/mapa`,
  /** Adventure screen (gameplay) */
  PLAY: (worldId: string) => `/aventura/${worldId}/jogar`,
} as const

/* ──────────────────────────────────────────────
   Navigation hook
   ────────────────────────────────────────────── */

/**
 * Drop-in replacement for the old `setView()` pattern.
 * Navigates via react-router AND syncs Zustand store IDs
 * so existing screen logic continues to work without changes.
 */
export function useNavigateGame() {
  const navigate = useNavigate()
  const {
    setView,
    setCurrentWorldId,
    setCurrentLocationId,
    setCurrentCharacterId,
    setEditingCharacterId,
  } = useGameStore()

  const goMenu = useCallback(() => {
    setView('menu')
    navigate(ROUTES.MENU)
  }, [navigate, setView])

  const goNewAdventure = useCallback(() => {
    setView('new')
    navigate(ROUTES.NEW_ADVENTURE)
  }, [navigate, setView])

  const goCharacters = useCallback(
    (worldId: string) => {
      setCurrentWorldId(worldId)
      setCurrentCharacterId(null)
      setCurrentLocationId(null)
      setView('characters')
      navigate(ROUTES.CHARACTERS(worldId))
    },
    [navigate, setView, setCurrentWorldId, setCurrentCharacterId, setCurrentLocationId],
  )

  const goNewCharacter = useCallback(
    (worldId: string) => {
      setCurrentWorldId(worldId)
      setEditingCharacterId(null)
      setView('create-character')
      navigate(ROUTES.NEW_CHARACTER(worldId))
    },
    [navigate, setView, setCurrentWorldId, setEditingCharacterId],
  )

  const goEditCharacter = useCallback(
    (worldId: string, charId: string) => {
      setCurrentWorldId(worldId)
      setEditingCharacterId(charId)
      setView('create-character')
      navigate(ROUTES.EDIT_CHARACTER(worldId, charId))
    },
    [navigate, setView, setCurrentWorldId, setEditingCharacterId],
  )

  const goMap = useCallback(
    (worldId: string) => {
      setCurrentWorldId(worldId)
      setView('blueprint')
      navigate(ROUTES.MAP(worldId))
    },
    [navigate, setView, setCurrentWorldId],
  )

  const goPlay = useCallback(
    (worldId: string, opts?: { locationId?: string; characterId?: string }) => {
      setCurrentWorldId(worldId)
      if (opts?.locationId) setCurrentLocationId(opts.locationId)
      if (opts?.characterId) setCurrentCharacterId(opts.characterId)
      setView('adventure')
      navigate(ROUTES.PLAY(worldId))
    },
    [navigate, setView, setCurrentWorldId, setCurrentLocationId, setCurrentCharacterId],
  )

  return { goMenu, goNewAdventure, goCharacters, goNewCharacter, goEditCharacter, goMap, goPlay }
}
