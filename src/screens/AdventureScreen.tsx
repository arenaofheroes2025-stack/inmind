import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  Backpack,
  Book,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Coins,
  Compass,
  Database,
  Heart,
  ListChecks,
  Loader2,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPin,
  Navigation,
  Package,
  Pen,
  RefreshCw,
  ScrollText,
  SkipForward,
  Swords,
  Target,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '../components/Badge'
import { CharacterDetailCard } from '../components/CharacterDetailCard'
import { CharacterPortrait } from '../components/CharacterPortrait'
import { ChoiceButton } from '../components/ChoiceButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DiamondDivider } from '../components/DiamondDivider'
import { DiceRollModal } from '../components/DiceRollModal'
import { HPBar } from '../components/HPBar'
import { InventoryPanel } from '../components/InventoryPanel'
import { LevelUpModal } from '../components/LevelUpModal'
import { LoadingCinematic } from '../components/LoadingCinematic'
import { NarrativeText, extractNarrativeTags, TAG_STYLES } from '../components/NarrativeText'
import type { NarrativeTag } from '../components/NarrativeText'
import { SectionCard } from '../components/SectionCard'

import type { Character, Equipment, Location, LocationContent, SaveState, ActionAttributes, BattleAttributes } from '../data/types'
import {
  getCharacter,
  getEquipment,
  getLocation,
  getSaveState,
  getScene,
  getWorld,
  listCharactersByWorld,
  listLocationsByWorld,
  deleteScene,
  saveScene,
  saveSaveState,
  saveDiaryEntry,
  listDiaryByWorld,
  saveCharacter,
  saveEquipment,
} from '../services/cache'
import type { SceneCache, DiaryEntry, DiaryAction } from '../services/cache'
import { getOrCreateLocationContent, generateLocationContent, cacheLocationContent } from '../services/locationArchitect'
import { useGameStore } from '../store/useGameStore'
import { useNavigateGame } from '../app/routes'
import { formatOutcome } from '../systems/narrative'
import type { Choice } from '../systems/narrative'
import {
  generateIntroNarration,
  generateOutcomeNarration,
  generateSceneNarration,
  validateCustomActions,
} from '../services/narrativeEngine'
import type { NarrativeContext, NarrativeResult, NarrativeMood, ValidatedAction, CustomActionInput } from '../services/narrativeEngine'
import type { RollResult } from '../utils/dice'

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }
const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } }
const stagger = { animate: { transition: { staggerChildren: 0.05 } } }

/* ── clipped-card visuals (CharacterCreateScreen pattern) ── */
const clipCard = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'

function CornerAccent({ size = 22, pos }: { size?: number; pos: 'tr' | 'bl' }) {
  return (
    <div className={`absolute z-20 ${pos === 'tr' ? 'right-0 top-0' : 'bottom-0 left-0'}`}>
      <svg width={size} height={size} className="text-gold/40">
        <line x1={pos === 'tr' ? 2 : 0} y1={pos === 'tr' ? 0 : 2} x2={pos === 'tr' ? size : size - 2} y2={pos === 'tr' ? size - 2 : size} stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  )
}

/* ── inline JSON viewer section ── */
function DataSection({
  label,
  sublabel,
  dataKey,
  expanded,
  onToggle,
  data,
}: {
  label: string
  sublabel: string
  dataKey: string
  expanded: string | null
  onToggle: (key: string | null) => void
  data: unknown
}) {
  const isOpen = expanded === dataKey
  return (
    <div className="overflow-hidden rounded-frame border border-ink/10 bg-panel/60">
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : dataKey)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gold/5"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-gold/60 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink">{label}</p>
          <p className="truncate text-[10px] text-ink-muted">{sublabel}</p>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-ink/10 bg-obsidian/40 p-4">
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-muted">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function AdventureScreen() {
  const world = useGameStore((state) => state.world)
  const currentWorldId = useGameStore((state) => state.currentWorldId)
  const currentLocationId = useGameStore((state) => state.currentLocationId)
  const currentCharacterId = useGameStore((state) => state.currentCharacterId)
  const setWorld = useGameStore((state) => state.setWorld)
  const setCurrentLocationId = useGameStore((state) => state.setCurrentLocationId)
  const { goMenu } = useNavigateGame()

  const [location, setLocation] = useState<Location | null>(null)
  const [availableLocations, setAvailableLocations] = useState<Location[]>([])
  const [content, setContent] = useState<LocationContent | null>(null)
  const [saveState, setSaveState] = useState<SaveState | null>(null)
  const [_character, setCharacter] = useState<Character | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const lastSavedLocationId = useRef<string | null>(null)

  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [travelTarget, setTravelTarget] = useState<Location | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showWorldInfo, setShowWorldInfo] = useState(false)
  const [showData, setShowData] = useState(false)
  const [showDiary, setShowDiary] = useState(false)
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([])
  const [expandedData, setExpandedData] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [partyCharacters, setPartyCharacters] = useState<Character[]>([])
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(null)
  const [expandedDiaryLocation, setExpandedDiaryLocation] = useState<string | null>(null)
  const [expandedDiaryEntry, setExpandedDiaryEntry] = useState<string | null>(null)
  const [showMissions, setShowMissions] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [showIntroNarrative, setShowIntroNarrative] = useState(false)
  const [introSeen, setIntroSeen] = useState(false)

  /* ── XP / Level-up state ── */

  const [levelUpChar, setLevelUpChar] = useState<Character | null>(null)
  const [levelUpNewLevel, setLevelUpNewLevel] = useState(1)

  /* ── player action state (inline on screen) ── */
  type PlayerAction = { characterId: string; actionText: string; skip: boolean; selectedTarget: NarrativeTag | null }
  const [playerActions, setPlayerActions] = useState<PlayerAction[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [customActionQueue, setCustomActionQueue] = useState<ValidatedAction[]>([])
  const [currentCustomAction, setCurrentCustomAction] = useState<ValidatedAction | null>(null)

  /* ── resolved outcomes (accumulated per round) ── */
  type ResolvedOutcome = {
    characterId: string
    characterName: string
    archetype: string
    portraitUrl?: string
    outcomeText: string
    consequence: string
    diceOutcome: string
    rollTotal: number
    difficulty: number
    riskLevel: string
    itemsObtained?: { name: string; rarity: string }[]
    goldObtained?: number
    xpGained?: number
  }
  const [resolvedOutcomes, setResolvedOutcomes] = useState<ResolvedOutcome[]>([])

  const worldId = world?.id ?? currentWorldId

  /* ── data loading ── */
  useEffect(() => {
    if (!worldId || world) return
    let m = true
    getWorld(worldId).then((c) => { if (c && m) setWorld(c) })
    return () => { m = false }
  }, [setWorld, world, worldId])

  useEffect(() => {
    if (!worldId) return
    let m = true
    const load = async () => {
      const c = await getSaveState(`save-${worldId}`)
      if (!m) return
      if (c) {
        setSaveState(c)
        if (!currentLocationId) setCurrentLocationId(c.currentLocationId)
      } else {
        const fallback: SaveState = {
          id: `save-${worldId}`, worldId, characterId: 'character-pending',
          currentLocationId: currentLocationId ?? '', activeQuestIds: [],
          currentActId: world?.acts?.[0]?.id ?? '',
          completedActIds: [],
          completedMissionIds: [],
          phase: 'playing', updatedAt: new Date().toISOString(),
        }
        await saveSaveState(fallback)
        setSaveState(fallback)
      }
    }
    load()
    return () => { m = false }
  }, [currentLocationId, setCurrentLocationId, worldId])

  useEffect(() => {
    if (!currentLocationId) return
    let m = true
    const load = async () => {
      setIsLoading(true)
      // Clear stale content so the narration effect won't fire with mismatched data
      setContent(null)
      const cached = await getLocation(currentLocationId)
      if (!m) return
      if (cached) {
        setLocation(cached)
        const gen = await getOrCreateLocationContent(cached, world ?? undefined)
        if (m) setContent(gen)
      }
      setIsLoading(false)
    }
    load()
    return () => { m = false }
  }, [currentLocationId, world])

  useEffect(() => {
    if (!world) return
    let m = true
    const load = async () => {
      const worldLocations = await listLocationsByWorld(world.id)
      if (m) setAvailableLocations(worldLocations)
    }
    load()
    return () => { m = false }
  }, [world])

  useEffect(() => {
    if (!currentCharacterId) return
    let m = true
    getCharacter(currentCharacterId).then((c) => { if (c && m) setCharacter(c) })
    return () => { m = false }
  }, [currentCharacterId])

  // Load all party characters for this world (only active ones)
  useEffect(() => {
    if (!worldId) return
    let m = true
    listCharactersByWorld(worldId).then((chars) => {
      if (m) {
        const party = chars.filter((c) => !c.disabled).slice(0, 4)
        setPartyCharacters(party)
        setPlayerActions(party.map((c) => ({ characterId: c.id, actionText: '', skip: false, selectedTarget: null })))
      }
    })
    return () => { m = false }
  }, [worldId])

  // Load diary entries
  useEffect(() => {
    if (!worldId) return
    let m = true
    listDiaryByWorld(worldId).then((entries) => {
      if (m) setDiaryEntries(entries)
    })
    return () => { m = false }
  }, [worldId])

  useEffect(() => {
    if (!currentLocationId || lastSavedLocationId.current === currentLocationId || !saveState) return
    const updated: SaveState = { ...saveState, currentLocationId, updatedAt: new Date().toISOString() }
    lastSavedLocationId.current = currentLocationId
    setSaveState(updated)
    saveSaveState(updated)
  }, [currentLocationId, saveState])

  /** Check if a location is accessible based on act progression */
  function isLocationUnlocked(loc: Location): boolean {
    if (!loc.unlockedByActId) return true
    if (!saveState) return false
    return saveState.completedActIds.includes(loc.unlockedByActId)
  }

  /** Get current act from world */
  const currentAct = world?.acts?.find((a) => a.id === saveState?.currentActId) ?? null
  const currentActMissions = currentAct?.missions ?? []
  const completedMissionCount = currentActMissions.filter((m) =>
    saveState?.completedMissionIds.includes(m.id)
  ).length
  const totalMissionCount = currentActMissions.length

  /** Resolve equipment names for all party inventory items */
  async function resolveEquipmentMap(chars: Character[]): Promise<Map<string, Equipment>> {
    const map = new Map<string, Equipment>()
    const ids = new Set<string>()
    for (const c of chars) {
      for (const inv of c.inventory ?? []) ids.add(inv.equipmentId)
    }
    await Promise.all(
      [...ids].map(async (id) => {
        const eq = await getEquipment(id)
        if (eq) map.set(id, eq)
      })
    )
    return map
  }

  /* ── scene (AI narrative) ── */
  const [scene, setScene] = useState<NarrativeResult | null>(null)
  const [isNarrating, setIsNarrating] = useState(false)
  const [outcomeText, setOutcomeText] = useState<string | null>(null)
  const narratedLocationRef = useRef<string | null>(null)

  useEffect(() => {
    if (!location || !content || !world) return
    if (isNarrating) return
    // Already narrated this location successfully
    if (narratedLocationRef.current === location.id && scene) return

    let m = true
    const narrate = async () => {
      // Try loading cached scene first
      const cachedScene = await getScene(`scene-${location.id}`)
      if (cachedScene && m) {
        const restored: NarrativeResult = {
          title: cachedScene.title,
          description: cachedScene.description,
          mood: (cachedScene.mood as NarrativeMood) ?? 'Neutro',
        }
        setScene(restored)
        narratedLocationRef.current = location.id
        console.log(`[AdventureScreen] Restored cached scene for "${location.name}"`)
        return
      }

      setIsNarrating(true)
      setOutcomeText(null)
      setScene(null)
      try {
        const eqMap = await resolveEquipmentMap(partyCharacters)
        const ctx: NarrativeContext = {
          world, location, content, characters: partyCharacters,
          previousActions: log.slice(0, 5),
          activeQuestIds: saveState?.activeQuestIds,
          previousMood: scene?.mood,
          previousSceneDescription: scene?.description,
          equipmentMap: eqMap,
        }
        const isIntro = log.length === 0 && partyCharacters.length > 0
        const result = isIntro
          ? await generateIntroNarration(ctx)
          : await generateSceneNarration(ctx)
        if (m) {
          setScene(result)
          narratedLocationRef.current = location.id

          // Show intro narrative overlay on first scene load
          if (isIntro && world.introNarrative && !introSeen) {
            setShowIntroNarrative(true)
            setIntroSeen(true)
          }

          // Persist scene to IndexedDB
          const sceneToCache: SceneCache = {
            id: `scene-${location.id}`,
            locationId: location.id,
            title: result.title,
            description: result.description,
            mood: result.mood,
            log: log.slice(0, 10),
            createdAt: new Date().toISOString(),
          }
          saveScene(sceneToCache).catch((err) =>
            console.warn('[AdventureScreen] Failed to cache scene:', err)
          )
        }
      } catch (err) {
        console.error('[AdventureScreen] Narration failed:', err)
      } finally {
        if (m) setIsNarrating(false)
      }
    }
    narrate()
    return () => { m = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.id, content?.id, world?.id])

  /* ── narrative tags available for interaction ── */
  const availableTags: NarrativeTag[] = scene ? extractNarrativeTags(scene.description) : []

  /* ── player action helpers ── */
  const updatePlayerAction = (characterId: string, text: string) => {
    setPlayerActions((prev) =>
      prev.map((a) => (a.characterId === characterId ? { ...a, actionText: text } : a)),
    )
  }

  const selectPlayerTarget = (characterId: string, target: NarrativeTag | null) => {
    setPlayerActions((prev) =>
      prev.map((a) =>
        a.characterId === characterId ? { ...a, selectedTarget: target, actionText: '' } : a,
      ),
    )
  }

  const togglePlayerSkip = (characterId: string) => {
    setPlayerActions((prev) =>
      prev.map((a) =>
        a.characterId === characterId
          ? { ...a, skip: !a.skip, actionText: a.skip ? a.actionText : '', selectedTarget: null }
          : a,
      ),
    )
  }

  const hasAnyPlayerAction = playerActions.some(
    (a) => !a.skip && a.selectedTarget !== null && a.actionText.trim().length > 0,
  )
  const allPlayersDefined = playerActions.length > 0 && playerActions.every(
    (a) => a.skip || (a.selectedTarget !== null && a.actionText.trim().length > 0),
  )

  const handleValidateActions = async () => {
    if (!world || !location || !content) return

    const activeActions: CustomActionInput[] = playerActions
      .filter((a) => !a.skip && a.selectedTarget !== null && a.actionText.trim().length > 0)
      .map((a) => {
        const char = partyCharacters.find((c) => c.id === a.characterId)
        const targetDesc = a.selectedTarget ? `[Alvo: ${a.selectedTarget.text} (${a.selectedTarget.label})] ` : ''
        return {
          characterId: a.characterId,
          characterName: char?.name ?? 'Aventureiro',
          actionText: `${targetDesc}${a.actionText.trim()}`,
        }
      })

    if (activeActions.length === 0) {
      setValidationError('Pelo menos um personagem deve realizar uma acao.')
      return
    }

    setIsValidating(true)
    setValidationError(null)

    try {
      const eqMap = await resolveEquipmentMap(partyCharacters)
      const ctx: NarrativeContext = {
        world, location, content, characters: partyCharacters,
        previousActions: log.slice(0, 5),
        activeQuestIds: saveState?.activeQuestIds,
        previousMood: scene?.mood,
        previousSceneDescription: scene?.description,
        equipmentMap: eqMap,
      }

      // Build previous outcomes summary for difficulty calibration
      const outcomesSummary = resolvedOutcomes.length > 0
        ? resolvedOutcomes.map((o) =>
          `${o.characterName} (${o.archetype}): d20=${o.rollTotal} → ${o.diceOutcome}. ${o.outcomeText.slice(0, 150)}`
        ).join('\n')
        : undefined

      const results = await validateCustomActions(
        ctx,
        activeActions,
        scene?.description,
        outcomesSummary,
      )
      const validActions = results.filter((a) => a.valid)
      const invalidActions = results.filter((a) => !a.valid)

      if (validActions.length === 0) {
        setValidationError(
          `Nenhuma acao valida. ${invalidActions.map((a) => `${a.characterName}: ${a.reason}`).join('. ')}`,
        )
        setIsValidating(false)
        return
      }

      if (invalidActions.length > 0) {
        setValidationError(
          `Acoes invalidas: ${invalidActions.map((a) => `${a.characterName} — ${a.reason}`).join('; ')}`,
        )
      }

      // Force affectsInventory when player targeted an [item:] tag
      for (const va of validActions) {
        const pa = playerActions.find((a) => a.characterId === va.characterId)
        if (pa?.selectedTarget?.category === 'item' && !va.affectsInventory) {
          console.log('[AdventureScreen] Forcing affectsInventory=true for item target:', pa.selectedTarget.text)
          va.affectsInventory = true
        }
      }

      // Start dice roll queue with valid actions
      const [first, ...rest] = validActions
      setCustomActionQueue(rest)
      setCurrentCustomAction(first)
    } catch (err) {
      console.error('[AdventureScreen] Validation failed:', err)
      setValidationError('Falha ao validar acoes. Tente novamente.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleDiceResult = async (result: RollResult) => {
    if (!currentCustomAction || !world || !location || !content) return
    const charName = result.characterName ?? currentCustomAction.characterName
    const mod = result.total - result.raw
    const entry = `[${charName}] ${currentCustomAction.description} (d20 ${result.raw} + ${mod} = ${result.total}) \u2192 ${formatOutcome(result.outcome)}`
    setLog((prev) => [entry, ...prev].slice(0, 50))

    const actionChoice: Choice = {
      id: 'player-action',
      description: currentCustomAction.description,
      primaryAttribute: currentCustomAction.primaryAttribute,
      difficulty: currentCustomAction.difficulty,
      riskLevel: currentCustomAction.riskLevel,
    }

    try {
      setIsNarrating(true)
      const eqMap = await resolveEquipmentMap(partyCharacters)
      const ctx: NarrativeContext = {
        world, location, content, characters: partyCharacters,
        previousActions: log.slice(0, 5),
        activeQuestIds: saveState?.activeQuestIds,
        previousMood: scene?.mood,
        previousSceneDescription: scene?.description,
        equipmentMap: eqMap,
      }
      const outcomeNarr = await generateOutcomeNarration(
        ctx, actionChoice, result.outcome, result.total, charName,
        undefined,
        undefined,
        currentCustomAction.affectsInventory,
      )
      setOutcomeText(outcomeNarr.text)

      // Accumulate outcome for post-round scene generation
      const char = partyCharacters.find((c) => c.id === currentCustomAction.characterId)

      // Track items and gold from this outcome
      let outcomeItems: { name: string; rarity: string }[] | undefined
      let outcomeGold: number | undefined
      // Running copy of party chars — updated across items, gold, and XP
      let latestChars = [...partyCharacters]

      // Process items obtained from AI outcome
      if (currentCustomAction.affectsInventory && outcomeNarr.itemsObtained?.length) {
        console.log('[AdventureScreen] Processing items:', JSON.stringify(outcomeNarr.itemsObtained))
        outcomeItems = []
        for (const grant of outcomeNarr.itemsObtained) {
          // Always fallback to the character who rolled the dice if the AI's characterId doesn't match
          let targetCharIdx = latestChars.findIndex((c) => c.id === grant.characterId)
          if (targetCharIdx === -1) {
            targetCharIdx = latestChars.findIndex((c) => c.id === currentCustomAction.characterId)
          }
          if (targetCharIdx === -1) {
            targetCharIdx = 0 // absolute fallback: first character
          }
          const targetChar = latestChars[targetCharIdx]
          if (!targetChar || !grant.item) continue

          // Clone the character to avoid direct state mutation
          const charClone = { ...targetChar, inventory: [...targetChar.inventory] }

          // Normalize the AI-generated item into a full Equipment object
          const equipment: Equipment = {
            id: grant.item.id || `gen-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: grant.item.name || 'Item Misterioso',
            type: (grant.item.type as Equipment['type']) || 'ferramenta',
            rarity: (grant.item.rarity as Equipment['rarity']) || 'comum',
            description: grant.item.description || '',
            narrativeEffect: grant.item.narrativeEffect || '',
            usageContext: (grant.item.usageContext as Equipment['usageContext']) || 'passivo',
            bonus: grant.item.bonus || {},
            difficultyReduction: Number(grant.item.difficultyReduction) || 0,
            hpRestore: Number(grant.item.hpRestore) || 0,
            sellPrice: Number(grant.item.sellPrice) || 0,
            consumable: Boolean(grant.item.consumable),
            equippable: Boolean(grant.item.equippable),
            stackable: Boolean(grant.item.stackable),
            maxStack: grant.item.stackable ? 99 : undefined,
          }

          // Save equipment to global store
          await saveEquipment(equipment)
          console.log('[AdventureScreen] Equipment saved to store:', equipment.id, equipment.name)

          // Add to character's inventory
          const qty = grant.quantity || 1
          const existingSlot = charClone.inventory.find((inv) => inv.equipmentId === equipment.id)
          if (existingSlot && equipment.stackable) {
            existingSlot.quantity += qty
          } else {
            charClone.inventory.push({
              id: `inv-${equipment.id}-${Date.now()}`,
              equipmentId: equipment.id,
              quantity: qty,
            })
          }

          // Save character and update local array
          await saveCharacter(charClone)
          latestChars[targetCharIdx] = charClone
          console.log('[AdventureScreen] Character inventory updated:', charClone.name, 'items:', charClone.inventory.length)

          outcomeItems.push({ name: equipment.name, rarity: equipment.rarity })
        }
        if (outcomeItems.length === 0) outcomeItems = undefined
      } else if (currentCustomAction.affectsInventory) {
        console.warn('[AdventureScreen] affectsInventory=true but no items in outcome:', {
          hasItemsObtained: !!outcomeNarr.itemsObtained,
          itemsLength: outcomeNarr.itemsObtained?.length ?? 0,
        })
      }

      // Process gold changes
      if (currentCustomAction.affectsInventory && outcomeNarr.goldObtained?.length) {
        let totalGoldForChar = 0
        for (const gc of outcomeNarr.goldObtained) {
          // Find character — fallback to the one who rolled
          let charIdx = latestChars.findIndex((c) => c.id === gc.characterId)
          if (charIdx === -1) {
            charIdx = latestChars.findIndex((c) => c.id === currentCustomAction.characterId)
          }
          if (charIdx === -1) charIdx = 0
          const targetChar = latestChars[charIdx]
          if (!targetChar) continue
          const charClone = { ...targetChar }
          const amount = Number(gc.amount) || 0
          charClone.gold = Math.max(0, (charClone.gold ?? 0) + amount)
          await saveCharacter(charClone)
          latestChars[charIdx] = charClone
          if (charClone.id === currentCustomAction.characterId) totalGoldForChar += amount
        }
        if (totalGoldForChar !== 0) outcomeGold = totalGoldForChar
      }

      // ── XP GRANT on successful action ──
      const isSuccess = result.outcome === 'partial' || result.outcome === 'success' || result.outcome === 'critical'
      let xpGained = 0
      if (isSuccess && currentCustomAction.difficulty > 0) {
        xpGained = currentCustomAction.difficulty
        const charIdx = latestChars.findIndex((c) => c.id === currentCustomAction.characterId)
        if (charIdx !== -1) {
          const charClone = { ...latestChars[charIdx] }
          const prevXp = charClone.xp ?? 0
          const prevLevel = charClone.level ?? 1
          const xpNeeded = prevLevel * 100
          const newXp = prevXp + xpGained

          if (newXp >= xpNeeded) {
            // LEVEL UP
            charClone.xp = newXp - xpNeeded
            charClone.level = prevLevel + 1
            await saveCharacter(charClone)
            latestChars[charIdx] = charClone
            // Delay level-up modal slightly so result card shows first
            const lvlChar = { ...charClone } // snapshot for modal
            const lvl = charClone.level
            setTimeout(() => {
              setLevelUpChar(lvlChar)
              setLevelUpNewLevel(lvl)
            }, 800)
          } else {
            charClone.xp = newXp
            await saveCharacter(charClone)
            latestChars[charIdx] = charClone
          }
        }
      }

      // Single state update with all accumulated character changes
      setPartyCharacters([...latestChars])

      setResolvedOutcomes((prev) => [
        ...prev,
        {
          characterId: currentCustomAction.characterId,
          characterName: charName,
          archetype: char?.archetype ?? '',
          portraitUrl: char?.portraitUrl,
          outcomeText: outcomeNarr.text,
          consequence: outcomeNarr.consequence,
          diceOutcome: result.outcome,
          rollTotal: result.total,
          difficulty: currentCustomAction.difficulty,
          riskLevel: currentCustomAction.riskLevel,
          itemsObtained: outcomeItems,
          goldObtained: outcomeGold,
          xpGained: xpGained > 0 ? xpGained : undefined,
        },
      ])
    } catch (err) {
      console.error('[AdventureScreen] Outcome narration failed:', err)
    } finally {
      setIsNarrating(false)
      setCurrentCustomAction(null)
    }
  }

  const closeDiceModal = () => {
    setCurrentCustomAction(null)
  }

  /** Called by DiceRollModal when a consumable item is used before rolling */
  const handleItemUsed = async (characterId: string, equipmentId: string) => {
    const char = partyCharacters.find((c) => c.id === characterId)
    if (!char) return
    const invSlot = char.inventory.find((inv) => inv.equipmentId === equipmentId)
    if (!invSlot) return
    const eq = await import('../services/cache').then((m) => m.getEquipment(equipmentId))
    if (eq?.consumable) {
      invSlot.quantity -= 1
      if (invSlot.quantity <= 0) {
        char.inventory = char.inventory.filter((inv) => inv.equipmentId !== equipmentId)
      }
      saveCharacter(char).catch(() => {})
    }
  }

  const advanceAfterOutcome = async () => {
    setOutcomeText(null)
    if (customActionQueue.length > 0) {
      // Next character in queue
      const [next, ...rest] = customActionQueue
      setCustomActionQueue(rest)
      setCurrentCustomAction(next)
    } else {
      // All actions resolved — generate new scene based on ALL outcomes
      if (!world || !location || !content) return
      setIsNarrating(true)
      setScene(null)
      // Reset action inputs
      setPlayerActions(partyCharacters.map((c) => ({ characterId: c.id, actionText: '', skip: false, selectedTarget: null })))
      setValidationError(null)

      // Build outcome summaries for the narrator
      const outcomeSummaries = resolvedOutcomes.map(
        (o) => {
          const diffTier = o.difficulty >= 15 ? 'ALTA' : o.difficulty >= 10 ? 'MEDIA' : 'BAIXA'
          const isFail = o.diceOutcome === 'fail' || o.diceOutcome === 'critical-fail'
          const resultLabel = isFail ? '*** FALHOU ***' : o.diceOutcome === 'partial' ? 'PARCIAL' : '*** SUCESSO ***'
          return `[${o.characterName} (${o.archetype})] Acao: ${o.consequence}. Dificuldade: ${o.difficulty} (${diffTier}), Risco: ${o.riskLevel}. Dado: ${o.rollTotal} → RESULTADO: ${resultLabel} (${o.diceOutcome}). ${isFail ? 'ESTE JOGADOR FRACASSOU — narre como FALHA.' : 'Este jogador teve sucesso.'} Narrativa individual: ${o.outcomeText.replace(/\n/g, ' ').slice(0, 400)}`
        },
      )

      // Save diary entry for this narrative cycle
      if (scene && worldId) {
        const diaryActions: DiaryAction[] = resolvedOutcomes.map((o) => {
          const pa = playerActions.find((a) => a.characterId === o.characterId)
          return {
            characterName: o.characterName,
            archetype: o.archetype,
            portraitUrl: o.portraitUrl,
            targetText: pa?.selectedTarget?.text,
            targetCategory: pa?.selectedTarget?.category,
            actionText: pa?.actionText ?? o.consequence,
            diceOutcome: o.diceOutcome,
            rollTotal: o.rollTotal,
            outcomeText: o.outcomeText,
            consequence: o.consequence,
            // Only include items/gold if something was obtained
            ...(o.itemsObtained?.length ? { itemsObtained: o.itemsObtained } : {}),
            ...(o.goldObtained ? { goldObtained: o.goldObtained } : {}),
          }
        })
        const entry: DiaryEntry = {
          id: `diary-${worldId}-${Date.now()}`,
          worldId,
          locationId: location.id,
          locationName: location.name,
          sceneTitle: scene.title,
          sceneDescription: scene.description,
          actions: diaryActions,
          createdAt: new Date().toISOString(),
        }
        saveDiaryEntry(entry).catch(() => {})
        setDiaryEntries((prev) => [...prev, entry])
      }

      try {
        const eqMap = await resolveEquipmentMap(partyCharacters)
        const ctx: NarrativeContext = {
          world, location, content, characters: partyCharacters,
          previousActions: log.slice(0, 10),
          activeQuestIds: saveState?.activeQuestIds,
          previousMood: scene?.mood,
          previousSceneDescription: scene?.description,
          equipmentMap: eqMap,
        }
        const result = await generateSceneNarration(ctx, outcomeSummaries)
        setScene(result)
        setResolvedOutcomes([])
        narratedLocationRef.current = location.id
        const sceneToCache: SceneCache = {
          id: `scene-${location.id}`,
          locationId: location.id,
          title: result.title,
          description: result.description,
          mood: result.mood,
          log: log.slice(0, 10),
          createdAt: new Date().toISOString(),
        }
        saveScene(sceneToCache).catch(() => {})
      } catch (err) {
        console.error('[AdventureScreen] Post-outcome narration failed:', err)
      } finally {
        setIsNarrating(false)
      }
    }
  }

  const confirmTravel = () => {
    if (!travelTarget) return
    narratedLocationRef.current = null
    setOutcomeText(null)
    setScene(null)
    setCurrentLocationId(travelTarget.id)
    setTravelTarget(null)
    setShowMap(false)
  }

  /* ── Level-Up confirm handler ── */
  const handleLevelUpConfirm = async (
    actionDeltas: Record<keyof ActionAttributes, number>,
    battleDeltas: Record<keyof BattleAttributes, number>,
  ) => {
    if (!levelUpChar) return
    const charIdx = partyCharacters.findIndex((c) => c.id === levelUpChar.id)
    if (charIdx === -1) return

    const charClone = { ...partyCharacters[charIdx] }
    // Apply action attribute deltas
    const aa = { ...charClone.actionAttributes }
    for (const key of Object.keys(actionDeltas) as (keyof ActionAttributes)[]) {
      aa[key] = (aa[key] ?? 0) + (actionDeltas[key] ?? 0)
    }
    charClone.actionAttributes = aa
    // Apply battle attribute deltas
    const ba = { ...charClone.battleAttributes }
    for (const key of Object.keys(battleDeltas) as (keyof BattleAttributes)[]) {
      ba[key] = (ba[key] ?? 0) + (battleDeltas[key] ?? 0)
    }
    charClone.battleAttributes = ba

    await saveCharacter(charClone)
    setPartyCharacters((prev) =>
      prev.map((c) => (c.id === charClone.id ? charClone : c)),
    )
    setLevelUpChar(null)
    setLevelUpNewLevel(1)
  }

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <>
      {/* ━━━ FULL-SCREEN BACKGROUND (location image, blurred) ━━━ */}
      {location?.imageUrl && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <img
            src={location.imageUrl}
            alt=""
            className="h-full w-full object-cover blur-2xl scale-110 saturate-[0.4] opacity-25"
          />
          <div className="absolute inset-0 bg-obsidian/60" />
        </div>
      )}

      <div className="relative -mx-4 -my-6 sm:-mx-6 sm:-my-8">
        {/* ━━━ LOCATION HERO IMAGE ━━━ */}
        <div className="relative h-56 w-full overflow-hidden sm:h-72 md:h-80">
          {location?.imageUrl ? (
            <motion.img
              key={location.id}
              src={location.imageUrl}
              alt={location.name}
              className="h-full w-full object-cover"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-panel via-surface to-obsidian" />
          )}
          {/* gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian/40 to-transparent" />

          {/* top bar overlay */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setShowBackConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-obsidian/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink backdrop-blur-md transition-colors hover:border-gold/30 hover:text-gold"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden sm:inline">Sair</span>
            </button>
            <div className="flex items-center gap-2">
              <Badge label={world?.title ?? 'Mundo'} variant="gold" icon={<Compass />} />
            </div>
          </div>

          {/* location name overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6">
            <motion.div key={location?.id} {...fadeUp} transition={{ duration: 0.4, delay: 0.1 }}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold/80">
                    <MapPin className="h-3 w-3" />
                    Localizacao atual
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
                    {location?.name ?? 'Explorando...'}
                  </h2>
                  {location?.description && (
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-muted/80">
                      {location.description}
                    </p>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    {location && <Badge label={location.type} size="sm" />}
                    {location && (
                      <Badge
                        label={`Risco ${location.dangerLevel}`}
                        size="sm"
                        variant={location.dangerLevel >= 3 ? 'danger' : 'default'}
                        icon={location.dangerLevel >= 3 ? <AlertTriangle /> : undefined}
                      />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ━━━ GAME HUD BAR ━━━ */}
        <div className="sticky top-0 z-30 border-y border-gold/10 bg-panel/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            {/* act progress (left side) */}
            {currentAct && (
              <div className="hidden items-center gap-2 md:flex">
                <Badge label={currentAct.title} variant="gold" size="sm" icon={<ScrollText />} />
                {totalMissionCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(completedMissionCount / totalMissionCount) * 100}%` }} />
                    </div>
                    <span className="text-[9px] text-ink-muted">{completedMissionCount}/{totalMissionCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* action buttons (right side) */}
            <div className="ml-auto flex items-center gap-1.5">
              {[
                { key: 'log', icon: <ScrollText className="h-3.5 w-3.5" />, label: 'Log', active: showLog, badge: log.length || undefined, badgeColor: 'bg-ember/80', onClick: () => setShowLog(!showLog) },
                { key: 'world', icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Mundo', active: false, onClick: () => setShowWorldInfo(true) },
                { key: 'data', icon: <Database className="h-3.5 w-3.5" />, label: 'Dados', active: false, onClick: () => setShowData(true) },
                { key: 'diary', icon: <Book className="h-3.5 w-3.5" />, label: 'Diário', active: showDiary, badge: diaryEntries.length || undefined, badgeColor: 'bg-gold/80 text-obsidian', onClick: () => setShowDiary(true) },
                { key: 'inventory', icon: <Backpack className="h-3.5 w-3.5" />, label: 'Mochila', active: showInventory, badge: partyCharacters.reduce((sum, c) => sum + (c.inventory?.length ?? 0), 0) || undefined, badgeColor: 'bg-gold/80 text-obsidian', onClick: () => setShowInventory(true) },
                { key: 'missions', icon: <ListChecks className="h-3.5 w-3.5" />, label: 'Missões', active: showMissions, badge: totalMissionCount > 0 ? `${completedMissionCount}/${totalMissionCount}` : undefined, badgeColor: 'bg-arcane/80', onClick: () => setShowMissions(true) },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={btn.onClick}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    btn.active
                      ? 'border-gold/30 bg-gold/10 text-gold'
                      : 'border-ink/10 text-ink-muted hover:border-gold/20 hover:text-ink'
                  }`}
                >
                  {btn.icon}
                  <span className="hidden sm:inline">{btn.label}</span>
                  {btn.badge != null && (
                    <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold text-white ${btn.badgeColor ?? 'bg-gold/80'}`}>
                      {btn.badge}
                    </span>
                  )}
                </button>
              ))}

              <DiamondDivider className="mx-1 hidden sm:flex" />

              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gold/25 bg-gradient-to-r from-gold/12 to-gold/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold transition-all hover:from-gold/20 hover:to-gold/10 hover:shadow-[0_0_12px_rgba(201,168,76,0.15)]"
              >
                <Navigation className="h-3.5 w-3.5" />
                Viajar
              </button>
            </div>
          </div>
        </div>
        {/* ━━━ PARTY BAR ━━━ */}
        {partyCharacters.length > 0 && (
          <div className="sticky top-[45px] z-20 border-b border-gold/8 bg-panel/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3 sm:gap-3 sm:px-6">
              {partyCharacters.map((pc) => {
                const isActive = pc.id === currentCharacterId
                const hpColor = pc.hp > 15 ? 'glow' as const : pc.hp > 8 ? 'gold' as const : 'ember' as const
                return (
                  <button
                    key={pc.id}
                    type="button"
                    onClick={() => setDetailCharacter(pc)}
                    className="group relative shrink-0 overflow-hidden border border-ink/10 bg-panel/80 transition-all hover:border-gold/20"
                    style={{ clipPath: clipCard }}
                  >
                    {isActive && (
                      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                    )}
                    <CornerAccent pos="tr" size={16} />
                    <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                      <CharacterPortrait
                        src={pc.portraitUrl}
                        fallback={pc.name[0]?.toUpperCase()}
                        variant="circle"
                        size="sm"
                        active={isActive}
                      />
                      <div className="flex flex-col gap-0.5">
                        <p className={`max-w-[72px] truncate text-[10px] font-bold leading-tight sm:max-w-[90px] ${
                          isActive ? 'text-gold' : 'text-ink'
                        }`}>
                          {pc.name}
                        </p>
                        <p className="text-[8px] uppercase tracking-wider text-ink-muted">
                          {pc.archetype}
                        </p>
                        <div className="flex w-20 items-center gap-1">
                          <Heart className={`h-3 w-3 shrink-0 ${
                            pc.hp > 15 ? 'text-glow' : pc.hp > 8 ? 'text-gold' : 'text-ember'
                          }`} />
                          <div className="flex-1">
                            <HPBar value={pc.hp} max={20} color={hpColor} size="sm" showValue={false} />
                          </div>
                          <span className="text-[9px] font-bold text-ink-muted">{pc.hp}</span>
                        </div>
                        <div className="flex w-20 items-center gap-1">
                          <span className="shrink-0 text-[8px] font-bold text-gold">Nv{pc.level ?? 1}</span>
                          <div className="flex-1">
                            <HPBar value={pc.xp ?? 0} max={(pc.level ?? 1) * 100} color="gold" size="sm" showValue={false} />
                          </div>
                          <span className="text-[9px] font-bold text-gold">{pc.xp ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ━━━ MAIN CONTENT ━━━ */}
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {isLoading ? (
            <div
              className="flex items-center justify-center border border-gold/15 bg-panel/80 py-16 backdrop-blur-sm"
              style={{ clipPath: clipCard }}
            >
              <LoadingCinematic label="Carregando local..." />
            </div>
          ) : null}

          {/* narrating loading state */}
          {isNarrating && !isLoading ? (
            <div
              className="flex items-center justify-center border border-gold/15 bg-panel/80 py-16 backdrop-blur-sm"
              style={{ clipPath: clipCard }}
            >
              <LoadingCinematic label="O narrador prepara a cena..." />
            </div>
          ) : null}

          {/* outcome narration (after dice roll) — with character portrait */}
          <AnimatePresence>
            {outcomeText && !isNarrating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5"
              >
                <div
                  className="relative overflow-hidden border border-gold/20 bg-panel/80"
                  style={{ clipPath: clipCard }}
                >
                  <CornerAccent pos="tr" />
                  <CornerAccent pos="bl" />
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
                  <div className="p-5 sm:p-6">
                    {/* ── character identity header ── */}
                    {(() => {
                      const latest = resolvedOutcomes[resolvedOutcomes.length - 1]
                      const char = latest
                        ? partyCharacters.find((c) => c.id === latest.characterId)
                        : null
                      return char ? (
                        <div className="mb-4 flex items-center gap-3 border-b border-gold/15 pb-4">
                          <CharacterPortrait
                            src={char.portraitUrl}
                            fallback={char.name[0]?.toUpperCase()}
                            variant="circle"
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-bold text-ink">{char.name}</p>
                            <p className="text-[10px] text-ink-muted">
                              {char.archetype} — Nv {char.level ?? 1}
                            </p>
                          </div>
                          {latest && (
                            <span
                              className={`ml-auto rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
                                latest.diceOutcome === 'critical'
                                  ? 'border-glow/30 bg-glow/10 text-glow'
                                  : latest.diceOutcome === 'success'
                                    ? 'border-glow/20 bg-glow/5 text-glow'
                                    : latest.diceOutcome === 'partial'
                                      ? 'border-gold/20 bg-gold/5 text-gold'
                                      : latest.diceOutcome === 'critical-fail'
                                        ? 'border-ember/30 bg-ember/10 text-ember'
                                        : 'border-ember/20 bg-ember/5 text-ember'
                              }`}
                            >
                              {latest.diceOutcome === 'critical'
                                ? 'Critico!'
                                : latest.diceOutcome === 'success'
                                  ? 'Sucesso'
                                  : latest.diceOutcome === 'partial'
                                    ? 'Parcial'
                                    : latest.diceOutcome === 'critical-fail'
                                      ? 'Falha Critica!'
                                      : 'Falha'}
                            </span>
                          )}
                        </div>
                      ) : null
                    })()}

                    <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold/70">
                      <Target className="h-3 w-3" />
                      Resultado
                    </p>
                    <NarrativeText text={outcomeText} />

                    {/* ── item/gold obtained notification ── */}
                    {(() => {
                      const latest = resolvedOutcomes[resolvedOutcomes.length - 1]
                      if (!latest) return null
                      const hasItems = latest.itemsObtained && latest.itemsObtained.length > 0
                      const hasGold = latest.goldObtained != null && latest.goldObtained !== 0
                      const hasXp = latest.xpGained != null && latest.xpGained > 0
                      if (!hasItems && !hasGold && !hasXp) return null
                      const rarityColors: Record<string, string> = {
                        comum: 'border-ink/20 bg-ink/5 text-ink-muted',
                        incomum: 'border-glow/30 bg-glow/10 text-glow',
                        raro: 'border-arcane/30 bg-arcane/10 text-arcane',
                        epico: 'border-gold/30 bg-gold/10 text-gold',
                        lendario: 'border-ember/30 bg-ember/10 text-ember',
                      }
                      const rarityLabels: Record<string, string> = {
                        comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário',
                      }
                      return (
                        <div className="mt-4 space-y-2">
                          {hasXp && (
                            <div className="flex items-center gap-3 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-gold">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-bold">✧</div>
                              <div className="flex-1">
                                <p className="text-xs font-bold">Experiência Ganha!</p>
                                <p className="text-sm font-semibold">+{latest.xpGained} EXP</p>
                              </div>
                            </div>
                          )}
                          {hasItems && latest.itemsObtained!.map((it, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${rarityColors[it.rarity] || rarityColors.comum}`}
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 text-lg">✦</div>
                              <div className="flex-1">
                                <p className="text-xs font-bold">Item Obtido!</p>
                                <p className="text-sm font-semibold">{it.name}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${rarityColors[it.rarity] || rarityColors.comum}`}>
                                {rarityLabels[it.rarity] || it.rarity}
                              </span>
                            </div>
                          ))}
                          {hasGold && (
                            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                              latest.goldObtained! > 0 ? 'border-gold/30 bg-gold/10 text-gold' : 'border-crimson/30 bg-crimson/10 text-crimson'
                            }`}>
                              <Coins className="h-5 w-5" />
                              <div className="flex-1">
                                <p className="text-xs font-bold">{latest.goldObtained! > 0 ? 'Ouro Recebido!' : 'Ouro Perdido!'}</p>
                                <p className="text-sm font-semibold">{latest.goldObtained! > 0 ? '+' : ''}{latest.goldObtained} ouro</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    <DiamondDivider className="my-4" />

                    <ChoiceButton
                      label={customActionQueue.length > 0
                        ? `Proximo jogador (${customActionQueue.length} restante${customActionQueue.length > 1 ? 's' : ''})...`
                        : 'Continuar aventura...'}
                      variant="gold"
                      size="sm"
                      icon={<ChevronRight />}
                      onClick={() => advanceAfterOutcome()}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* scene */}
          {scene && !isLoading && !isNarrating ? (
            <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="space-y-5">
              {/* narrative box — hidden during outcome phase */}
              {!outcomeText && resolvedOutcomes.length === 0 && (
                <div
                  className="relative overflow-hidden border border-gold/15 bg-panel/80"
                  style={{ clipPath: clipCard }}
                >
                  <CornerAccent pos="tr" />
                  <CornerAccent pos="bl" />
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                  <div className="p-5 sm:p-6">
                    <Badge label="Narrativa" variant="gold" icon={<ScrollText />} size="sm" />
                    <h3 className="mt-3 font-display text-lg font-bold text-ink">{scene.title}</h3>
                    <NarrativeText text={scene.description} />
                  </div>
                </div>
              )}

              {/* player action inputs */}
              {!outcomeText && (
                <div>
                  <Badge label="Ações" variant="gold" icon={<Pen />} size="sm" />
                  <p className="mt-2 mb-3 text-xs text-ink-muted">
                    O que cada jogador deseja fazer?
                  </p>

                  <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2">
                    {partyCharacters.map((char) => {
                      const action = playerActions.find((a) => a.characterId === char.id)
                      const isSkipped = action?.skip ?? false
                      const selectedTarget = action?.selectedTarget ?? null

                      return (
                        <motion.div
                          key={char.id}
                          variants={fadeUp}
                          className={`relative overflow-hidden border transition-all ${
                            isSkipped
                              ? 'border-ink/10 bg-surface/30 opacity-50'
                              : 'border-gold/15 bg-panel/60'
                          }`}
                          style={{ clipPath: clipCard }}
                        >
                          {!isSkipped && (
                            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                          )}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <CharacterPortrait
                              src={char.portraitUrl}
                              fallback={char.name[0]?.toUpperCase()}
                              variant="circle"
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-ink">{char.name}</p>
                              <p className="text-[10px] text-ink-muted">
                                {char.archetype} — Nv {char.level ?? 1}
                              </p>
                            </div>
                            <ChoiceButton
                              label={isSkipped ? 'Vai agir' : 'Pular'}
                              variant={isSkipped ? 'gold' : 'ghost'}
                              size="sm"
                              icon={<SkipForward />}
                              onClick={() => togglePlayerSkip(char.id)}
                              className="!w-auto"
                            />
                          </div>

                          {!isSkipped && (
                            <div className="border-t border-ink/8 px-4 py-3 space-y-2">
                              {/* target selection */}
                              <p className="text-[9px] uppercase tracking-wider text-ink-muted/60">
                                Escolha com o que interagir:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {availableTags.map((tag) => {
                                  const style = TAG_STYLES[tag.category]
                                  const isSelected = selectedTarget?.text === tag.text && selectedTarget?.category === tag.category
                                  return (
                                    <button
                                      key={`${tag.category}-${tag.text}`}
                                      type="button"
                                      onClick={() =>
                                        selectPlayerTarget(char.id, isSelected ? null : tag)
                                      }
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${
                                        isSelected
                                          ? `${style.text} ${style.bg} ${style.border} ring-1 ring-current shadow-sm`
                                          : `${style.text} border-ink/12 hover:${style.border} hover:${style.bg} opacity-70 hover:opacity-100`
                                      }`}
                                    >
                                      <span className="text-[9px]">{style.icon}</span>
                                      {tag.text}
                                    </button>
                                  )
                                })}
                                {availableTags.length === 0 && (
                                  <span className="text-[10px] italic text-ink-muted/40">Nenhum elemento destacado na cena</span>
                                )}
                              </div>

                              {/* action text (only visible after selecting a target) */}
                              {selectedTarget && (
                                <div className="space-y-1.5">
                                  <p className="text-[9px] uppercase tracking-wider text-ink-muted/60">
                                    Como {char.name} interage com{' '}
                                    <span className={`font-bold ${TAG_STYLES[selectedTarget.category].text}`}>
                                      {selectedTarget.text}
                                    </span>
                                    ?
                                  </p>
                                  <textarea
                                    value={action?.actionText ?? ''}
                                    onChange={(e) => updatePlayerAction(char.id, e.target.value)}
                                    placeholder={`Descreva a acao (ex: "Pergunto sobre os rumores da floresta", "Examino com cuidado")`}
                                    rows={2}
                                    className="w-full resize-none rounded-lg border border-ink/15 bg-obsidian/40 px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-muted/40 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </motion.div>

                  {/* validation error */}
                  {validationError && (
                    <SectionCard className="mt-3" glow="ember">
                      <div className="flex items-start gap-2 text-xs leading-relaxed text-ember">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {validationError}
                      </div>
                    </SectionCard>
                  )}

                  <DiamondDivider className="my-4" />

                  {/* validate + roll button */}
                  <ChoiceButton
                    label={isValidating ? 'Validando acoes...' : 'Confirmar Acoes'}
                    variant="gold"
                    size="lg"
                    icon={isValidating ? <Loader2 className="animate-spin" /> : <ChevronRight />}
                    onClick={handleValidateActions}
                    disabled={!allPlayersDefined || isValidating}
                  />
                </div>
              )}
            </motion.div>
          ) : null}

          {!scene && !isLoading && !isNarrating && (
            <div
              className="flex flex-col items-center gap-4 border border-ink/10 bg-panel/60 py-16 text-center"
              style={{ clipPath: clipCard }}
            >
              <Compass className="h-10 w-10 text-ink-muted/40" />
              <p className="text-sm text-ink-muted">
                Use o botao <span className="font-semibold text-gold">Viajar</span> para explorar os locais do mundo.
              </p>
            </div>
          )}

          {/* action log panel (collapsible) */}
          <AnimatePresence>
            {showLog && log.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 overflow-hidden"
              >
                <Badge label="Log de acoes" size="sm" icon={<ScrollText />} />
                <SectionCard className="mt-2" glow="none">
                  <div className="space-y-1.5">
                    {log.map((entry, i) => (
                      <motion.div
                        key={`${entry}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className={`rounded-lg px-3 py-2 text-xs ${
                          i === 0
                            ? 'border border-gold/15 bg-gold/5 text-ink'
                            : 'text-ink-muted'
                        }`}
                      >
                        {entry}
                      </motion.div>
                    ))}
                  </div>
                </SectionCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ━━━ DIARY OVERLAY ━━━ */}
        <AnimatePresence>
          {showDiary && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col bg-obsidian/95 backdrop-blur-md"
            >
              {/* header */}
              <div className="relative border-b border-gold/15 bg-panel/90 backdrop-blur-md">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="flex items-center justify-between px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-2">
                    <Badge label="Diário de Aventura" variant="gold" icon={<Book />} />
                    <span className="text-[10px] text-ink-muted">
                      {diaryEntries.length} registro{diaryEntries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDiary(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition-colors hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* diary content — grouped by location */}
              <div className="flex-1 overflow-y-auto">
                {diaryEntries.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <Book className="h-8 w-8 text-ink-muted/30" />
                    <p className="text-sm text-ink-muted">
                      Nenhum registro ainda. As narrativas e resultados serao salvos aqui.
                    </p>
                  </div>
                ) : (() => {
                  // Group entries by locationId
                  const grouped = diaryEntries.reduce<Record<string, { locationId: string; locationName: string; entries: typeof diaryEntries }>>((acc, e) => {
                    if (!acc[e.locationId]) {
                      acc[e.locationId] = { locationId: e.locationId, locationName: e.locationName, entries: [] }
                    }
                    acc[e.locationId].entries.push(e)
                    return acc
                  }, {})
                  const locationGroups = Object.values(grouped)

                  return (
                    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
                      <div className="space-y-4">
                        {locationGroups.map((group) => {
                          const loc = availableLocations.find((l) => l.id === group.locationId)
                          const isExpanded = expandedDiaryLocation === group.locationId

                          return (
                            <div
                              key={group.locationId}
                              className="overflow-hidden rounded-frame border border-gold/10 bg-panel/60"
                            >
                              {/* location header — clickable with image */}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedDiaryLocation(isExpanded ? null : group.locationId)
                                }
                                className="relative flex w-full items-center gap-0 text-left transition-colors hover:bg-gold/5"
                              >
                                {/* location thumbnail */}
                                <div className="relative h-20 w-24 shrink-0 overflow-hidden sm:h-24 sm:w-32">
                                  {loc?.imageUrl ? (
                                    <img
                                      src={loc.imageUrl}
                                      alt={group.locationName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-gradient-to-br from-surface via-panel to-obsidian" />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-panel/80" />
                                </div>
                                <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-ink">
                                      {group.locationName}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-ink-muted">
                                      {group.entries.length} cena{group.entries.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <ChevronRight
                                    className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${
                                      isExpanded ? 'rotate-90' : ''
                                    }`}
                                  />
                                </div>
                              </button>

                              {/* expanded: entries for this location */}
                              {isExpanded && (
                                <div className="border-t border-gold/8">
                                  <div className="space-y-1.5 p-3">
                                    {group.entries.map((entry, idx) => {
                                      const isEntryExpanded = expandedDiaryEntry === entry.id
                                      return (
                                      <div
                                        key={entry.id}
                                        className="overflow-hidden rounded-lg border border-ink/8 bg-obsidian/20"
                                      >
                                        {/* scene title — clickable to expand */}
                                        <button
                                          type="button"
                                          onClick={() => setExpandedDiaryEntry(isEntryExpanded ? null : entry.id)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gold/5"
                                        >
                                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/8 text-[9px] font-bold text-gold">
                                            {idx + 1}
                                          </span>
                                          <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">
                                            {entry.sceneTitle}
                                          </p>
                                          <span className="shrink-0 text-[9px] text-ink-muted">
                                            {new Date(entry.createdAt).toLocaleString('pt-BR', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                          <ChevronRight
                                            className={`h-3 w-3 shrink-0 text-ink-muted transition-transform ${
                                              isEntryExpanded ? 'rotate-90' : ''
                                            }`}
                                          />
                                        </button>

                                        {/* entry content — collapsed by default */}
                                        {isEntryExpanded && (
                                          <>
                                        {/* narration */}
                                        <div className="border-t border-ink/5 px-3 py-2">
                                          <p className="mb-1 flex items-center gap-1 text-[8px] uppercase tracking-[0.3em] text-gold/50">
                                            <ScrollText className="h-2.5 w-2.5" />
                                            Narrativa
                                          </p>
                                          <div className="rounded-md border border-ink/5 bg-obsidian/30 px-2.5 py-1.5">
                                            <NarrativeText text={entry.sceneDescription} className="text-[10px]" />
                                          </div>
                                        </div>

                                        {/* actions */}
                                        {entry.actions.length > 0 && (
                                          <div className="border-t border-ink/5 px-3 pb-2.5 pt-2">
                                            <p className="mb-1.5 flex items-center gap-1 text-[8px] uppercase tracking-[0.3em] text-gold/50">
                                              <Swords className="h-2.5 w-2.5" />
                                              Ações e Resultados
                                            </p>
                                            <div className="space-y-1.5">
                                              {entry.actions.map((act, aIdx) => (
                                                <div
                                                  key={aIdx}
                                                  className="rounded-md border border-ink/6 bg-obsidian/15 px-2.5 py-2"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    {act.portraitUrl ? (
                                                      <CharacterPortrait
                                                        src={act.portraitUrl}
                                                        fallback={act.characterName[0]?.toUpperCase()}
                                                        variant="circle"
                                                        size="xs"
                                                      />
                                                    ) : (
                                                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[9px] font-bold text-ink-muted">
                                                        {act.characterName[0]?.toUpperCase()}
                                                      </div>
                                                    )}
                                                    <span className="text-[11px] font-bold text-ink">
                                                      {act.characterName}
                                                    </span>
                                                    <span className="text-[9px] text-ink-muted">
                                                      {act.archetype}
                                                    </span>
                                                    <span
                                                      className={`ml-auto rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase ${
                                                        act.diceOutcome === 'critical'
                                                          ? 'border-glow/30 bg-glow/10 text-glow'
                                                          : act.diceOutcome === 'success'
                                                            ? 'border-glow/20 bg-glow/5 text-glow'
                                                            : act.diceOutcome === 'partial'
                                                              ? 'border-gold/20 bg-gold/5 text-gold'
                                                              : act.diceOutcome === 'critical-fail'
                                                                ? 'border-ember/30 bg-ember/10 text-ember'
                                                                : 'border-ember/20 bg-ember/5 text-ember'
                                                      }`}
                                                    >
                                                      d20: {act.rollTotal}
                                                    </span>
                                                  </div>
                                                  {act.targetText && (
                                                    <p className="mt-1 text-[10px] text-ink-muted">
                                                      Alvo: <span className="font-semibold text-ink">{act.targetText}</span>
                                                    </p>
                                                  )}
                                                  <p className="mt-1 text-[10px] text-ink-muted">
                                                    Ação: <span className="italic">{act.actionText}</span>
                                                  </p>
                                                  <div className="mt-1.5 border-t border-ink/5 pt-1.5">
                                                    <NarrativeText text={act.outcomeText} className="text-[10px]" />
                                                  </div>
                                                  {/* item badges */}
                                                  {act.itemsObtained && act.itemsObtained.length > 0 && (
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded border border-gold/20 bg-gold/5 px-2 py-1">
                                                      <Package className="h-3 w-3 text-gold" />
                                                      <span className="text-[9px] text-ink-muted">Itens:</span>
                                                      {act.itemsObtained.map((it, idx) => {
                                                        const rarityColors: Record<string, string> = {
                                                          comum: 'text-ink-muted',
                                                          incomum: 'text-glow',
                                                          raro: 'text-arcane',
                                                          epico: 'text-gold',
                                                          lendario: 'text-ember',
                                                        }
                                                        return (
                                                          <span key={idx} className={`text-[9px] font-bold ${rarityColors[it.rarity] ?? 'text-ink-muted'}`}>
                                                            ✦ {it.name}
                                                          </span>
                                                        )
                                                      })}
                                                    </div>
                                                  )}
                                                  {/* gold badge */}
                                                  {act.goldObtained != null && act.goldObtained !== 0 && (
                                                    <div className="mt-1 flex items-center gap-1.5 rounded border border-gold/20 bg-gold/5 px-2 py-0.5">
                                                      <Coins className="h-3 w-3 text-gold" />
                                                      <span className={`text-[9px] font-bold ${act.goldObtained > 0 ? 'text-gold' : 'text-crimson'}`}>
                                                        {act.goldObtained > 0 ? '+' : ''}{act.goldObtained} ouro
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                          </>
                                        )}
                                      </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━ DATA VIEWER OVERLAY ━━━ */}
        <AnimatePresence>
          {showData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col bg-obsidian/95 backdrop-blur-md"
            >
              {/* header */}
              <div className="relative border-b border-gold/15 bg-panel/90 backdrop-blur-md">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="flex items-center justify-between px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-3">
                    <Badge label="Dados em Cache" variant="gold" icon={<Database />} />
                    <p className="text-[10px] text-ink-muted">
                      JSON dos dados salvos no jogo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowData(false); setExpandedData(null) }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="mx-auto max-w-4xl space-y-2">
                  {/* Regenerate button */}
                  {location && (
                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={async () => {
                        if (!location || !world) return
                        setIsRegenerating(true)
                        try {
                          // 1. Regenerate location content
                          const newContent = await generateLocationContent(location, world)
                          const normalized = { ...newContent, id: `content-${location.id}`, locationId: location.id }
                          await cacheLocationContent(normalized)
                          setContent(normalized)

                          // 2. Delete cached scene & regenerate narrative
                          await deleteScene(`scene-${location.id}`)
                          narratedLocationRef.current = null
                          setScene(null)
                          setOutcomeText(null)

                          const eqMap = await resolveEquipmentMap(partyCharacters)
                          const ctx: NarrativeContext = {
                            world, location, content: normalized, characters: partyCharacters,
                            previousActions: log.slice(0, 5),
                            activeQuestIds: saveState?.activeQuestIds,
                            previousMood: scene?.mood,
                            previousSceneDescription: scene?.description,
                            equipmentMap: eqMap,
                          }
                          const result = log.length === 0 && partyCharacters.length > 0
                            ? await generateIntroNarration(ctx)
                            : await generateSceneNarration(ctx)
                          setScene(result)
                          narratedLocationRef.current = location.id

                          // 3. Cache the new scene
                          const sceneToCache: SceneCache = {
                            id: `scene-${location.id}`,
                            locationId: location.id,
                            title: result.title,
                            description: result.description,
                            mood: result.mood,
                            log: log.slice(0, 10),
                            createdAt: new Date().toISOString(),
                          }
                          await saveScene(sceneToCache)
                          console.log(`[AdventureScreen] Regenerated content + narrative for "${location.name}"`)
                        } catch (err) {
                          console.error('[AdventureScreen] Regeneration failed:', err)
                        } finally {
                          setIsRegenerating(false)
                        }
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-frame border border-gold/20 bg-gold/5 px-4 py-3 text-xs font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                    >
                      {isRegenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Regenerando...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4" /> Regenerar Dados do Local + Narrativa</>
                      )}
                    </button>
                  )}

                  {/* World */}
                  {world && (
                    <DataSection
                      label="Mundo"
                      sublabel={world.title}
                      dataKey="world"
                      expanded={expandedData}
                      onToggle={setExpandedData}
                      data={world}
                    />
                  )}

                  {/* Location */}
                  {location && (
                    <DataSection
                      label="Local Atual"
                      sublabel={location.name}
                      dataKey="location"
                      expanded={expandedData}
                      onToggle={setExpandedData}
                      data={location}
                    />
                  )}

                  {/* Location Content */}
                  {content && (
                    <DataSection
                      label="Conteudo do Local"
                      sublabel={`${content.npcs?.length ?? 0} NPCs, ${(content.quests?.main?.length ?? 0) + (content.quests?.side?.length ?? 0)} quests`}
                      dataKey="content"
                      expanded={expandedData}
                      onToggle={setExpandedData}
                      data={content}
                    />
                  )}

                  {/* Characters */}
                  {partyCharacters.map((pc) => (
                    <DataSection
                      key={pc.id}
                      label="Personagem"
                      sublabel={`${pc.name} (${pc.archetype})`}
                      dataKey={`char-${pc.id}`}
                      expanded={expandedData}
                      onToggle={setExpandedData}
                      data={pc}
                    />
                  ))}

                  {/* Save State */}
                  {saveState && (
                    <DataSection
                      label="Save State"
                      sublabel={`Atualizado: ${new Date(saveState.updatedAt).toLocaleString('pt-BR')}`}
                      dataKey="save"
                      expanded={expandedData}
                      onToggle={setExpandedData}
                      data={saveState}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━ WORLD INFO OVERLAY ━━━ */}
        <AnimatePresence>
          {showWorldInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col bg-obsidian/95 backdrop-blur-md"
            >
              {/* header */}
              <div className="relative border-b border-gold/15 bg-panel/90 backdrop-blur-md">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="flex items-center justify-between px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-3">
                    <Badge label={world?.title ?? 'Mundo'} variant="gold" icon={<BookOpen />} />
                    <p className="text-[10px] text-ink-muted">
                      Informacoes do mundo e progresso
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWorldInfo(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* scrollable content */}
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">

                  {/* world map */}
                  {world?.mapUrl && (
                    <motion.div {...fadeIn} transition={{ duration: 0.5 }}>
                      <div className="overflow-hidden rounded-frame border border-gold/20 shadow-[0_0_40px_rgba(201,168,76,0.08)]">
                        <img
                          src={world.mapUrl}
                          alt={`Mapa de ${world.title}`}
                          className="w-full object-contain"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* world details */}
                  {world && (
                    <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
                      <SectionCard glow="gold">
                        <Badge label="Sobre o mundo" variant="gold" icon={<Compass />} size="sm" />
                        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                          {world.synopsis}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {world.genre && (
                            <span className="rounded-full border border-gold/15 bg-gold/5 px-2.5 py-1 text-[10px] font-semibold text-gold">
                              {world.genre}
                            </span>
                          )}
                          {world.narrativeStyle && (
                            <span className="rounded-full border border-arcane/15 bg-arcane/5 px-2.5 py-1 text-[10px] font-semibold text-arcane">
                              {world.narrativeStyle}
                            </span>
                          )}
                          {world.tone && (
                            <span className="rounded-full border border-ember/15 bg-ember/5 px-2.5 py-1 text-[10px] font-semibold text-ember">
                              {world.tone}
                            </span>
                          )}
                        </div>

                        {/* final objective */}
                        {world.finalObjective && (
                          <>
                            <DiamondDivider className="my-4" />
                            <div className="rounded-lg border border-gold/10 bg-gold/5 p-3">
                              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold/70">
                                <Target className="h-3 w-3" />
                                Objetivo final
                              </p>
                              <p className="mt-1.5 text-xs leading-relaxed text-ink">
                                {world.finalObjective}
                              </p>
                            </div>
                          </>
                        )}
                      </SectionCard>
                    </motion.div>
                  )}

                  {/* acts / chapters */}
                  {world?.acts && world.acts.length > 0 && (
                    <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
                      <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-ink-muted">
                        <ScrollText className="h-3 w-3" />
                        Atos da historia ({world.acts.length})
                      </p>
                      <div className="space-y-2">
                        {world.acts.map((act, idx) => {
                          const isCurrentAct = act.id === saveState?.currentActId
                          const isCompleted = saveState?.completedActIds.includes(act.id) ?? false
                          const isLocked = !isCurrentAct && !isCompleted
                          const actMissions = act.missions ?? []
                          const actDone = actMissions.filter((m) => saveState?.completedMissionIds.includes(m.id)).length

                          return (
                            <div
                              key={act.id}
                              className={`rounded-frame border p-4 transition-all ${
                                isCurrentAct
                                  ? 'border-gold/30 bg-gold/5 shadow-[0_0_16px_rgba(201,168,76,0.1)]'
                                  : isCompleted
                                    ? 'border-glow/20 bg-glow/5'
                                    : 'border-ink/10 bg-panel/60 opacity-60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                                    isCurrentAct
                                      ? 'border-gold/40 bg-gold/15 text-gold'
                                      : isCompleted
                                        ? 'border-glow/30 bg-glow/10 text-glow'
                                        : 'border-ink/15 bg-ink/5 text-ink-muted'
                                  }`}>
                                    {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : isLocked ? <Lock className="h-3 w-3" /> : idx + 1}
                                  </div>
                                  <div>
                                    <p className={`text-xs font-bold ${
                                      isCurrentAct ? 'text-gold' : isCompleted ? 'text-glow' : 'text-ink-muted'
                                    }`}>
                                      {act.title}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                                      {act.goal}
                                    </p>
                                    {/* mission progress */}
                                    {actMissions.length > 0 && (isCurrentAct || isCompleted) && (
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <div className="h-1 w-20 overflow-hidden rounded-full bg-ink/10">
                                          <div
                                            className={`h-full rounded-full ${isCompleted ? 'bg-glow' : 'bg-gold'}`}
                                            style={{ width: `${(actDone / actMissions.length) * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-[9px] text-ink-muted">{actDone}/{actMissions.length}</span>
                                      </div>
                                    )}
                                    {/* linked locations */}
                                    {act.linkedLocations && act.linkedLocations.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {act.linkedLocations.map((ref) => {
                                          const loc = availableLocations.find((l) => l.id === ref.id)
                                          return loc ? (
                                            <span key={ref.id} className="flex items-center gap-1 rounded-full border border-ink/10 bg-panel/80 px-2 py-0.5 text-[9px] text-ink-muted">
                                              <MapPin className="h-2.5 w-2.5" />
                                              {loc.name}
                                            </span>
                                          ) : null
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isCurrentAct && (
                                  <span className="shrink-0 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                                    Atual
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="shrink-0 rounded-full border border-glow/20 bg-glow/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-glow">
                                    Concluido
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* action history */}
                  {log.length > 0 && (
                    <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.2 }}>
                      <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-ink-muted">
                        <Swords className="h-3 w-3" />
                        Historico de acoes ({log.length})
                      </p>
                      <div className="space-y-1.5 rounded-frame border border-ink/10 bg-panel/60 p-3">
                        {log.map((entry, i) => (
                          <div
                            key={`winfo-${entry}-${i}`}
                            className={`rounded-lg px-3 py-2 text-xs ${
                              i === 0
                                ? 'border border-gold/15 bg-gold/5 text-ink'
                                : 'text-ink-muted'
                            }`}
                          >
                            {entry}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━ TRAVEL / MAP OVERLAY ━━━ */}
        <AnimatePresence>
          {showMap && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col bg-obsidian/95 backdrop-blur-md"
            >
              {/* map header */}
              <div className="relative border-b border-gold/15 bg-panel/90 backdrop-blur-md">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="flex items-center justify-between px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-3">
                    <Badge label={`Mapa — ${world?.title}`} variant="gold" icon={<MapIcon />} />
                    <p className="text-[10px] text-ink-muted">
                      {availableLocations.length} locais disponiveis
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMap(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* scrollable map content */}
              <div className="flex-1 overflow-y-auto">
                {/* world map image */}
                {world?.mapUrl && (
                  <motion.div
                    {...fadeIn}
                    transition={{ duration: 0.5 }}
                    className="relative mx-auto max-w-4xl p-4 sm:p-6"
                  >
                    <div className="overflow-hidden rounded-frame border border-gold/20 shadow-[0_0_40px_rgba(201,168,76,0.08)]">
                      <img
                        src={world.mapUrl}
                        alt={`Mapa de ${world.title}`}
                        className="w-full object-contain"
                      />
                    </div>
                  </motion.div>
                )}

                {/* location cards grid */}
                <div className="mx-auto max-w-4xl px-4 pb-8 sm:px-6">
                  <Badge label="Destinos" size="sm" icon={<MapPin />} />

                  <motion.div variants={stagger} initial="initial" animate="animate" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {availableLocations.map((loc) => {
                      const isCurrent = loc.id === currentLocationId
                      const unlocked = isLocationUnlocked(loc)
                      const requiredAct = !unlocked && loc.unlockedByActId
                        ? world?.acts?.find((a) => a.id === loc.unlockedByActId)
                        : null
                      return (
                        <motion.div
                          key={loc.id}
                          variants={fadeUp}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!isCurrent && unlocked) setTravelTarget(loc)
                            }}
                            disabled={isCurrent || !unlocked}
                            className={`group relative w-full overflow-hidden border text-left transition-all ${
                              !unlocked
                                ? 'border-ink/20 opacity-70 cursor-not-allowed'
                                : isCurrent
                                  ? 'border-gold/30 shadow-[0_0_20px_rgba(201,168,76,0.12)]'
                                  : 'border-ink/10 hover:border-gold/20 hover:shadow-[0_0_16px_rgba(201,168,76,0.06)]'
                            }`}
                            style={{ clipPath: clipCard }}
                          >
                            {/* location image */}
                            <div className="relative h-32 w-full overflow-hidden sm:h-36">
                              {loc.imageUrl ? (
                                <img
                                  src={loc.imageUrl}
                                  alt={loc.name}
                                  className={`h-full w-full object-cover transition-transform duration-500 ${
                                    unlocked ? 'group-hover:scale-105' : 'grayscale'
                                  }`}
                                />
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-surface via-panel to-obsidian" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/30 to-transparent" />

                              {/* lock overlay */}
                              {!unlocked && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-obsidian/60">
                                  <Lock className="h-8 w-8 text-ink-muted/60" />
                                  <span className="rounded-full border border-crimson/30 bg-crimson/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-crimson">
                                    Bloqueado
                                  </span>
                                </div>
                              )}

                              {/* current badge */}
                              {isCurrent && unlocked && (
                                <div className="absolute left-2 top-2">
                                  <Badge label="Voce esta aqui" variant="gold" icon={<MapPin />} />
                                </div>
                              )}

                              {/* danger indicator */}
                              <div className="absolute right-2 top-2">
                                <Badge
                                  label={`Risco ${loc.dangerLevel}`}
                                  size="sm"
                                  variant={loc.dangerLevel >= 3 ? 'danger' : 'default'}
                                  icon={loc.dangerLevel >= 3 ? <AlertTriangle /> : undefined}
                                />
                              </div>

                              {/* name at bottom of image */}
                              <div className="absolute inset-x-0 bottom-0 p-3">
                                <p className="font-display text-sm font-bold text-ink">{loc.name}</p>
                                <p className="text-[10px] uppercase tracking-wider text-ink-muted">{loc.type}</p>
                              </div>
                            </div>

                            {/* card body */}
                            <div className="bg-panel/80 p-3">
                              {loc.description && (
                                <p className="line-clamp-2 text-[11px] leading-relaxed text-ink-muted">
                                  {loc.description}
                                </p>
                              )}
                              <div className="mt-2.5">
                                {!unlocked ? (
                                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-crimson/80">
                                    <Lock className="h-3 w-3" />
                                    {requiredAct ? `Requer: ${requiredAct.title}` : 'Requer ato anterior'}
                                  </div>
                                ) : isCurrent ? (
                                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gold">
                                    <MapPin className="h-3 w-3" />
                                    Localizacao atual
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ember transition-colors group-hover:text-gold">
                                    <Navigation className="h-3 w-3" />
                                    Viajar para ca
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* hover accent */}
                            {!isCurrent && unlocked && (
                              <div className="absolute inset-x-0 bottom-0 h-0.5 w-0 bg-gradient-to-r from-gold to-ember transition-all duration-300 group-hover:w-full" />
                            )}
                          </button>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ━━━ INTRO NARRATIVE OVERLAY ━━━ */}
      <AnimatePresence>
        {showIntroNarrative && world?.introNarrative && (
          <motion.div
            key="intro-narrative-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-obsidian/95 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative w-full max-w-2xl overflow-hidden rounded-frame border border-gold/30 bg-panel/95 shadow-[0_0_60px_rgba(201,168,76,0.15)]"
            >
              {/* hero image */}
              {location?.imageUrl && (
                <div className="relative h-40 w-full overflow-hidden sm:h-52">
                  <img
                    src={location.imageUrl}
                    alt={location.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-gold/70">
                      {world.genre} — {world.narrativeStyle ?? world.tone}
                    </p>
                    <h1 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
                      {world.title}
                    </h1>
                  </div>
                </div>
              )}
              {!location?.imageUrl && (
                <div className="border-b border-gold/15 bg-gradient-to-b from-gold/5 to-transparent p-5 pt-6">
                  <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-gold/70">
                    {world.genre} — {world.narrativeStyle ?? world.tone}
                  </p>
                  <h1 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
                    {world.title}
                  </h1>
                </div>
              )}

              {/* narrative text */}
              <div className="p-5 sm:p-6">
                <p className="text-sm leading-relaxed text-ink/90 whitespace-pre-line">
                  {world.introNarrative}
                </p>

                {/* first mission teaser */}
                {currentAct && currentActMissions.length > 0 && (
                  <SectionCard className="mt-5" glow="none">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-arcane/70">
                      <ListChecks className="h-3 w-3" />
                      Primeira Missão
                    </p>
                    <p className="mt-1.5 text-xs font-bold text-ink">
                      {currentActMissions[0].title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                      {currentActMissions[0].description}
                    </p>
                  </SectionCard>
                )}

                {/* starting location */}
                {location && (
                  <SectionCard className="mt-4" glow="gold">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-gold" />
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gold/70">Local inicial</p>
                        <p className="text-xs font-semibold text-ink">{location.name}</p>
                      </div>
                    </div>
                  </SectionCard>
                )}

                <DiamondDivider className="my-5" />

                {/* begin button */}
                <ChoiceButton
                  label="Iniciar Aventura"
                  variant="gold"
                  size="lg"
                  icon={<ChevronRight />}
                  onClick={() => setShowIntroNarrative(false)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ MISSIONS TRACKER OVERLAY ━━━ */}
      <AnimatePresence>
        {showMissions && world?.acts && (
          <motion.div
            key="missions-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-obsidian/95 backdrop-blur-sm"
          >
            {/* header */}
            <div className="relative border-b border-arcane/20 bg-panel/90 backdrop-blur-md">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-arcane/30 to-transparent" />
              <div className="flex items-center justify-between px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <Badge label="Missões & Atos" variant="gold" icon={<ListChecks />} />
                  {currentAct && (
                    <p className="text-[10px] text-ink-muted">
                      Ato: <span className="font-semibold text-arcane">{currentAct.title}</span>
                      {totalMissionCount > 0 && (
                        <span className="ml-2">
                          — {completedMissionCount}/{totalMissionCount}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMissions(false)}
                  className="rounded-lg border border-ink/10 p-2 text-ink-muted transition-colors hover:border-ink/20 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto max-w-3xl space-y-4">
                {world.acts.map((act, idx) => {
                  const isCurrentActItem = act.id === saveState?.currentActId
                  const isCompletedAct = saveState?.completedActIds.includes(act.id) ?? false
                  const isLockedAct = !isCurrentActItem && !isCompletedAct
                  const actMissions = act.missions ?? []
                  const actCompletedCount = actMissions.filter((m) =>
                    saveState?.completedMissionIds.includes(m.id)
                  ).length

                  return (
                    <motion.div
                      key={act.id}
                      {...fadeUp}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className={`overflow-hidden rounded-frame border transition-all ${
                        isCurrentActItem
                          ? 'border-arcane/30 shadow-[0_0_20px_rgba(139,92,246,0.12)]'
                          : isCompletedAct
                            ? 'border-glow/20'
                            : 'border-ink/10 opacity-60'
                      }`}
                    >
                      {/* act header */}
                      <div className={`flex items-start gap-3 p-4 ${
                        isCurrentActItem ? 'bg-arcane/5' : isCompletedAct ? 'bg-glow/5' : 'bg-panel/60'
                      }`}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                          isCurrentActItem
                            ? 'border-arcane/40 bg-arcane/15 text-arcane'
                            : isCompletedAct
                              ? 'border-glow/30 bg-glow/10 text-glow'
                              : 'border-ink/15 bg-ink/5 text-ink-muted'
                        }`}>
                          {isCompletedAct ? <CheckCircle2 className="h-4 w-4" /> : isLockedAct ? <Lock className="h-3.5 w-3.5" /> : idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold ${
                              isCurrentActItem ? 'text-arcane' : isCompletedAct ? 'text-glow' : 'text-ink-muted'
                            }`}>
                              {act.title}
                            </p>
                            {isCurrentActItem && (
                              <span className="rounded-full border border-arcane/20 bg-arcane/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-arcane">
                                Atual
                              </span>
                            )}
                            {isCompletedAct && (
                              <span className="rounded-full border border-glow/20 bg-glow/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-glow">
                                Concluído
                              </span>
                            )}
                            {isLockedAct && (
                              <span className="rounded-full border border-ink/15 bg-ink/5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-ink-muted">
                                Bloqueado
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{act.goal}</p>
                          {/* progress bar */}
                          {actMissions.length > 0 && (isCurrentActItem || isCompletedAct) && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isCompletedAct ? 'bg-glow' : 'bg-arcane'
                                  }`}
                                  style={{ width: `${actMissions.length > 0 ? (actCompletedCount / actMissions.length) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-semibold text-ink-muted">
                                {actCompletedCount}/{actMissions.length}
                              </span>
                            </div>
                          )}
                          {/* key NPCs */}
                          {act.keyNpcs && act.keyNpcs.length > 0 && (isCurrentActItem || isCompletedAct) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {act.keyNpcs.map((npc) => (
                                <span key={npc.name} className="flex items-center gap-1 rounded-full border border-ink/10 bg-panel/80 px-2 py-0.5 text-[9px] text-ink-muted">
                                  <Target className="h-2.5 w-2.5" />
                                  {npc.name} — <span className="italic">{npc.role}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* mission list */}
                      {actMissions.length > 0 && (isCurrentActItem || isCompletedAct) && (
                        <div className="border-t border-ink/10 bg-panel/40 p-3 space-y-2">
                          {actMissions.map((mission) => {
                            const mCompleted = saveState?.completedMissionIds.includes(mission.id) ?? false
                            return (
                              <div
                                key={mission.id}
                                className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                                  mCompleted
                                    ? 'border-glow/15 bg-glow/5'
                                    : 'border-ink/10 bg-panel/60'
                                }`}
                              >
                                {mCompleted ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-glow" />
                                ) : (
                                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted/40" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-bold ${mCompleted ? 'text-glow line-through' : 'text-ink'}`}>
                                    {mission.title}
                                  </p>
                                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                                    {mission.description}
                                  </p>
                                  {mission.linkedNpcNames && mission.linkedNpcNames.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {mission.linkedNpcNames.map((npcName) => (
                                        <span key={npcName} className="rounded-full border border-arcane/15 bg-arcane/5 px-2 py-0.5 text-[8px] font-semibold text-arcane">
                                          {npcName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* linked locations */}
                      {act.linkedLocations && act.linkedLocations.length > 0 && (isCurrentActItem || isCompletedAct) && (
                        <div className="border-t border-ink/8 bg-panel/30 px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {act.linkedLocations.map((ref) => {
                              const loc = availableLocations.find((l) => l.id === ref.id)
                              return loc ? (
                                <span key={ref.id} className="flex items-center gap-1 rounded-full border border-ink/10 bg-panel/80 px-2 py-0.5 text-[9px] text-ink-muted">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {loc.name}
                                </span>
                              ) : null
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* confirm travel */}
      <ConfirmDialog
        open={travelTarget !== null}
        title="Viajar para outro local?"
        description={
          travelTarget
            ? `Tem certeza que deseja ir para "${travelTarget.name}"? A cena atual sera encerrada.`
            : ''
        }
        confirmLabel="Viajar"
        cancelLabel="Ficar aqui"
        onConfirm={confirmTravel}
        onCancel={() => setTravelTarget(null)}
      />

      {/* dice roll modal (sequential per character) */}
      {(() => {
        if (!currentCustomAction) return null
        const char = partyCharacters.find(
          (c) => c.id === currentCustomAction.characterId,
        )
        const singleChar = char ? [char] : partyCharacters.slice(0, 1)
        const actionEntry = playerActions.find(
          (a) => a.characterId === currentCustomAction.characterId,
        )
        return (
          <DiceRollModal
            open
            actionDescription={currentCustomAction.description}
            attribute={currentCustomAction.primaryAttribute}
            partyCharacters={singleChar}
            difficulty={currentCustomAction.difficulty}
            riskLevel={currentCustomAction.riskLevel}
            affectsInventory={currentCustomAction.affectsInventory}
            targetTag={actionEntry?.selectedTarget ?? null}
            onResult={handleDiceResult}
            onClose={closeDiceModal}
            onItemUsed={handleItemUsed}
          />
        )
      })()}
      {/* confirm back */}
      <ConfirmDialog
        open={showBackConfirm}
        title="Sair da aventura?"
        description="Tem certeza que deseja voltar ao menu? Seu progresso esta salvo automaticamente."
        confirmLabel="Sim, sair"
        cancelLabel="Continuar jogando"
        variant="danger"
        onConfirm={() => { setShowBackConfirm(false); goMenu() }}
        onCancel={() => setShowBackConfirm(false)}
      />

      {/* character detail card */}
      {detailCharacter && (
        <CharacterDetailCard
          character={detailCharacter}
          open
          onClose={() => setDetailCharacter(null)}
        />
      )}

      {/* inventory panel */}
      <InventoryPanel
        open={showInventory}
        characters={partyCharacters}
        onClose={() => setShowInventory(false)}
        onCharactersUpdated={(chars) => setPartyCharacters(chars)}
      />

      {/* Level-up modal */}
      <LevelUpModal
        open={!!levelUpChar}
        character={levelUpChar!}
        newLevel={levelUpNewLevel}
        onConfirm={handleLevelUpConfirm}
      />
    </>
  )
}
