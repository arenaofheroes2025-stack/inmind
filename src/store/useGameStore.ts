import { create } from 'zustand'
import type { Character, World } from '../data/types'

export const DEFAULT_ADVENTURE_TITLE = 'Nenhuma aventura selecionada'

type GameState = {
  adventureTitle: string
  phase: 'idle' | 'ready' | 'playing'
  view: 'menu' | 'new' | 'characters' | 'create-character' | 'blueprint' | 'adventure' | 'battle'
  world: World | null
  currentWorldId: string | null
  currentLocationId: string | null
  currentCharacterId: string | null
  editingCharacterId: string | null
  currentBattleId: string | null
  savedWorlds: World[]
  savedCharacters: Character[]
  isGenerating: boolean
  error: string | null
  setAdventureTitle: (title: string) => void
  setPhase: (phase: GameState['phase']) => void
  setView: (view: GameState['view']) => void
  setWorld: (world: World | null) => void
  setCurrentWorldId: (id: string | null) => void
  setCurrentLocationId: (id: string | null) => void
  setCurrentCharacterId: (id: string | null) => void
  setEditingCharacterId: (id: string | null) => void
  setCurrentBattleId: (id: string | null) => void
  setSavedWorlds: (worlds: World[]) => void
  setSavedCharacters: (characters: Character[]) => void
  setGenerating: (isGenerating: boolean) => void
  setError: (error: string | null) => void
}

export const useGameStore = create<GameState>((set) => ({
  adventureTitle: DEFAULT_ADVENTURE_TITLE,
  phase: 'idle',
  view: 'menu',
  world: null,
  currentWorldId: null,
  currentLocationId: null,
  currentCharacterId: null,
  editingCharacterId: null,
  currentBattleId: null,
  savedWorlds: [],
  savedCharacters: [],
  isGenerating: false,
  error: null,
  setAdventureTitle: (title) => set({ adventureTitle: title, phase: 'ready' }),
  setPhase: (phase) => set({ phase }),
  setView: (view) => set({ view }),
  setWorld: (world) => set({ world }),
  setCurrentWorldId: (id) => set({ currentWorldId: id }),
  setCurrentLocationId: (id) => set({ currentLocationId: id }),
  setCurrentCharacterId: (id) => set({ currentCharacterId: id }),
  setEditingCharacterId: (id) => set({ editingCharacterId: id }),
  setCurrentBattleId: (id) => set({ currentBattleId: id }),
  setSavedWorlds: (worlds) => set({ savedWorlds: worlds }),
  setSavedCharacters: (characters) => set({ savedCharacters: characters }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
}))
