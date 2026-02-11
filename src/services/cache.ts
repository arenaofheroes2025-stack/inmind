import { openDB } from 'idb'
import type {
  BattleState,
  Character,
  Enemy,
  Equipment,
  Location,
  LocationContent,
  Quest,
  SaveState,
  World,
} from '../data/types'

const DB_NAME = 'inmind'
const DB_VERSION = 7

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('worlds')) {
      db.createObjectStore('worlds', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('locations')) {
      db.createObjectStore('locations', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('locationContent')) {
      db.createObjectStore('locationContent', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('quests')) {
      db.createObjectStore('quests', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('characters')) {
      db.createObjectStore('characters', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('enemies')) {
      db.createObjectStore('enemies', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('saveStates')) {
      db.createObjectStore('saveStates', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('battles')) {
      db.createObjectStore('battles', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('scenes')) {
      db.createObjectStore('scenes', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('diary')) {
      db.createObjectStore('diary', { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains('characterOptions')) {
      db.createObjectStore('characterOptions', { keyPath: 'worldId' })
    }
    if (!db.objectStoreNames.contains('equipment')) {
      db.createObjectStore('equipment', { keyPath: 'id' })
    }
  },
})

export async function saveWorld(world: World) {
  const db = await dbPromise
  await db.put('worlds', world)
}

export async function getWorld(id: string) {
  const db = await dbPromise
  return db.get('worlds', id) as Promise<World | undefined>
}

export async function listWorlds() {
  const db = await dbPromise
  return db.getAll('worlds') as Promise<World[]>
}

export async function saveLocation(location: Location) {
  const db = await dbPromise
  await db.put('locations', location)
}

export async function getLocation(id: string) {
  const db = await dbPromise
  return db.get('locations', id) as Promise<Location | undefined>
}

export async function listLocations() {
  const db = await dbPromise
  return db.getAll('locations') as Promise<Location[]>
}

export async function listLocationsByWorld(worldId: string) {
  const db = await dbPromise
  const all = await db.getAll('locations') as Location[]
  return all.filter((l) => l.worldId === worldId)
}

export async function saveLocationContent(content: LocationContent) {
  const db = await dbPromise
  await db.put('locationContent', content)
}

export async function getLocationContent(id: string) {
  const db = await dbPromise
  return db.get('locationContent', id) as Promise<LocationContent | undefined>
}

export async function saveQuest(quest: Quest) {
  const db = await dbPromise
  await db.put('quests', quest)
}

export async function getQuest(id: string) {
  const db = await dbPromise
  return db.get('quests', id) as Promise<Quest | undefined>
}

export async function saveCharacter(character: Character) {
  const db = await dbPromise
  await db.put('characters', character)
}

export async function getCharacter(id: string) {
  const db = await dbPromise
  return db.get('characters', id) as Promise<Character | undefined>
}

export async function listCharacters() {
  const db = await dbPromise
  return db.getAll('characters') as Promise<Character[]>
}

export async function listCharactersByWorld(worldId: string) {
  const db = await dbPromise
  const all = await db.getAll('characters') as Character[]
  return all.filter((c) => c.worldId === worldId)
}

export async function saveEnemy(enemy: Enemy) {
  const db = await dbPromise
  await db.put('enemies', enemy)
}

export async function getEnemy(id: string) {
  const db = await dbPromise
  return db.get('enemies', id) as Promise<Enemy | undefined>
}

export async function saveSaveState(state: SaveState) {
  const db = await dbPromise
  await db.put('saveStates', state)
}

export async function getSaveState(id: string) {
  const db = await dbPromise
  return db.get('saveStates', id) as Promise<SaveState | undefined>
}

export async function listSaveStates() {
  const db = await dbPromise
  return db.getAll('saveStates') as Promise<SaveState[]>
}

export async function saveBattle(state: BattleState) {
  const db = await dbPromise
  await db.put('battles', state)
}

export async function getBattle(id: string) {
  const db = await dbPromise
  return db.get('battles', id) as Promise<BattleState | undefined>
}

/* ── Scene Cache ── */

export type SceneCache = {
  id: string           // format: "scene-{locationId}"
  locationId: string
  title: string
  description: string
  mood?: string
  choices?: Array<{
    id: string
    description: string
    primaryAttribute: string
    difficulty: number
    riskLevel: 'low' | 'medium' | 'high'
  }>
  log: string[]        // action log at time of creation
  createdAt: string
}

export async function saveScene(scene: SceneCache) {
  const db = await dbPromise
  await db.put('scenes', scene)
}

export async function getScene(id: string) {
  const db = await dbPromise
  return db.get('scenes', id) as Promise<SceneCache | undefined>
}

export async function deleteScene(id: string) {
  const db = await dbPromise
  await db.delete('scenes', id)
}

/* ── Diary (narrative journal) ── */

export type DiaryAction = {
  characterName: string
  archetype: string
  portraitUrl?: string
  targetText?: string
  targetCategory?: string
  actionText: string
  diceOutcome: string
  rollTotal: number
  outcomeText: string
  consequence: string
  itemsObtained?: { name: string; rarity: string }[]  // items gained from this action
  goldObtained?: number        // gold gained/lost from this action
}

export type DiaryEntry = {
  id: string                   // unique: `diary-{worldId}-{timestamp}`
  worldId: string
  locationId: string
  locationName: string
  sceneTitle: string           // narrative title — used as chapter heading
  sceneDescription: string     // the narrative text (with tags)
  actions: DiaryAction[]       // player actions + outcomes for this cycle
  createdAt: string
}

export async function saveDiaryEntry(entry: DiaryEntry) {
  const db = await dbPromise
  await db.put('diary', entry)
}

export async function getDiaryEntry(id: string) {
  const db = await dbPromise
  return db.get('diary', id) as Promise<DiaryEntry | undefined>
}

export async function listDiaryByWorld(worldId: string): Promise<DiaryEntry[]> {
  const db = await dbPromise
  const all = await db.getAll('diary') as DiaryEntry[]
  return all
    .filter((e) => e.worldId === worldId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function deleteDiaryEntry(id: string) {
  const db = await dbPromise
  await db.delete('diary', id)
}

/* ── Character Options (AI-generated, cached per world) ── */

export async function saveCharacterOptions(worldId: string, options: unknown) {
  const db = await dbPromise
  await db.put('characterOptions', { worldId, options })
}

export async function getCharacterOptions(worldId: string) {
  const db = await dbPromise
  const entry = await db.get('characterOptions', worldId) as { worldId: string; options: unknown } | undefined
  return entry?.options ?? null
}

/* ── Equipment (global item store) ── */

export async function saveEquipment(eq: Equipment) {
  const db = await dbPromise
  await db.put('equipment', eq)
}

export async function getEquipment(id: string) {
  const db = await dbPromise
  return db.get('equipment', id) as Promise<Equipment | undefined>
}

export async function getAllEquipment(): Promise<Equipment[]> {
  const db = await dbPromise
  return db.getAll('equipment') as Promise<Equipment[]>
}

export async function saveEquipmentBatch(items: Equipment[]) {
  const db = await dbPromise
  const tx = db.transaction('equipment', 'readwrite')
  await Promise.all([...items.map((eq) => tx.store.put(eq)), tx.done])
}
