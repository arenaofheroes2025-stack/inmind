/**
 * Narrative Director — Orchestrator that coordinates all AI narrative agents.
 *
 * This module does NOT call AI itself. It coordinates the flow between agents
 * and handles all business logic (items, gold, XP, diary, scene caching).
 *
 * Responsibilities:
 * - Build NarrativeContext from game state (single source of truth)
 * - Coordinate: scene → validate actions → dice → outcome → loot → next scene
 * - Process item grants (save equipment, update inventory)
 * - Process gold changes
 * - Process XP and level-up detection
 * - Create diary entries
 * - Manage scene caching
 */

import type { Character, Equipment, Location, LocationContent, World, ActionAttributes, BattleAttributes } from '../data/types'
import type { Choice, RollOutcome } from '../systems/narrative'
import { formatOutcome } from '../systems/narrative'

// Agents
import { narrateIntro, narrateScene } from './agents/storyNarrator'
import { validateActions } from './agents/actionValidator'
import { narrateOutcome } from './agents/outcomeNarrator'
import { generateLoot } from './agents/lootGenerator'

// Shared types — re-export for consumers
export type { NarrativeContext, NarrativeMood, NarrativeResult, OutcomeNarrative, ValidatedAction, CustomActionInput, ItemGrant, GoldChange, LootResult } from './agents/shared'
import type { NarrativeContext, NarrativeResult, NarrativeMood, ValidatedAction, CustomActionInput } from './agents/shared'

// Cache
import {
  saveScene,
  getScene,
  deleteScene,
  saveDiaryEntry,
  saveCharacter,
  saveEquipment,
} from './cache'
import type { SceneCache, DiaryAction, DiaryEntry } from './cache'

/* ──────────────────────────────────────────────
   Context Builder (single source of truth)
   ────────────────────────────────────────────── */

export function buildNarrativeContext(
  world: World,
  location: Location,
  content: LocationContent,
  characters: Character[],
  opts?: {
    previousActions?: string[]
    activeQuestIds?: string[]
    previousMood?: NarrativeMood
    previousSceneDescription?: string
  },
): NarrativeContext {
  return {
    world,
    location,
    content,
    characters,
    previousActions: opts?.previousActions,
    activeQuestIds: opts?.activeQuestIds,
    previousMood: opts?.previousMood,
    previousSceneDescription: opts?.previousSceneDescription,
  }
}

/* ──────────────────────────────────────────────
   Scene Generation
   ────────────────────────────────────────────── */

export type SceneLoadResult = {
  scene: NarrativeResult
  fromCache: boolean
}

/**
 * Load or generate a scene for a location.
 * Tries cache first, then generates via AI.
 */
export async function loadOrGenerateScene(
  ctx: NarrativeContext,
  isIntro: boolean,
  recentOutcomes?: string[],
): Promise<SceneLoadResult> {
  const locationId = ctx.location.id

  // Try cache (only for fresh scenes, not continuations)
  if (!recentOutcomes?.length) {
    const cached = await getScene(`scene-${locationId}`)
    if (cached) {
      const restored: NarrativeResult = {
        title: cached.title,
        description: cached.description,
        mood: (cached.mood as NarrativeMood) ?? 'Neutro',
      }
      console.log(`[NarrativeDirector] Restored cached scene for location ${locationId}`)
      return { scene: restored, fromCache: true }
    }
  }

  // Generate via AI
  const scene = isIntro
    ? await narrateIntro(ctx)
    : await narrateScene(ctx, recentOutcomes)

  // Cache the scene
  const sceneToCache: SceneCache = {
    id: `scene-${locationId}`,
    locationId,
    title: scene.title,
    description: scene.description,
    mood: scene.mood,
    log: ctx.previousActions?.slice(0, 10) ?? [],
    createdAt: new Date().toISOString(),
  }
  saveScene(sceneToCache).catch((err) =>
    console.warn('[NarrativeDirector] Failed to cache scene:', err),
  )

  return { scene, fromCache: false }
}

/** Invalidate cached scene for a location (e.g. on travel). */
export async function invalidateSceneCache(locationId: string): Promise<void> {
  await deleteScene(`scene-${locationId}`).catch(() => {})
}

/* ──────────────────────────────────────────────
   Action Validation
   ────────────────────────────────────────────── */

export type ActionValidationResult = {
  validActions: ValidatedAction[]
  invalidActions: ValidatedAction[]
}

/**
 * Validate player actions and return categorized results.
 */
export async function validatePlayerActions(
  ctx: NarrativeContext,
  actions: CustomActionInput[],
  sceneDescription?: string,
  resolvedOutcomes?: ResolvedOutcome[],
): Promise<ActionValidationResult> {
  const outcomesSummary = resolvedOutcomes?.length
    ? resolvedOutcomes.map((o) =>
        `${o.characterName} (${o.archetype}): d20=${o.rollTotal} → ${o.diceOutcome}. ${o.outcomeText.slice(0, 150)}`
      ).join('\n')
    : undefined

  const results = await validateActions(
    ctx,
    actions,
    sceneDescription,
    outcomesSummary,
  )

  return {
    validActions: results.filter((a) => a.valid),
    invalidActions: results.filter((a) => !a.valid),
  }
}

/* ──────────────────────────────────────────────
   Dice Outcome Processing
   ────────────────────────────────────────────── */

export type ResolvedOutcome = {
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

export type DiceResultInput = {
  validatedAction: ValidatedAction
  outcome: RollOutcome
  rollTotal: number
  characterName: string
  raw: number
}

export type ProcessedDiceResult = {
  resolved: ResolvedOutcome
  updatedCharacters: Character[]
  levelUp?: { character: Character; newLevel: number }
  logEntry: string
}

/**
 * Process a dice result: narrate outcome, generate loot if applicable,
 * grant XP, check level-up, and return all mutations.
 */
export async function processDiceResult(
  ctx: NarrativeContext,
  input: DiceResultInput,
  currentCharacters: Character[],
  sceneDescription?: string,
): Promise<ProcessedDiceResult> {
  const { validatedAction, outcome, rollTotal, characterName, raw } = input
  const mod = rollTotal - raw

  // Log entry
  const logEntry = `[${characterName}] ${validatedAction.description} (d20 ${raw} + ${mod} = ${rollTotal}) → ${formatOutcome(outcome)}`

  // Build Choice for outcome narration
  const actionChoice: Choice = {
    id: 'player-action',
    description: validatedAction.description,
    primaryAttribute: validatedAction.primaryAttribute,
    difficulty: validatedAction.difficulty,
    riskLevel: validatedAction.riskLevel,
  }

  // 1. Narrate outcome (pure text, no items/gold)
  const outcomeNarr = await narrateOutcome(
    ctx, actionChoice, outcome, rollTotal, characterName, sceneDescription,
  )

  // Running copy of characters
  let latestChars = [...currentCharacters]

  // 2. Generate loot if applicable
  let outcomeItems: { name: string; rarity: string }[] | undefined
  let outcomeGold: number | undefined
  const isSuccess = outcome === 'partial' || outcome === 'success' || outcome === 'critical'

  if (validatedAction.affectsInventory && isSuccess) {
    const lootResult = await generateLoot(
      ctx, actionChoice, outcome, rollTotal,
      validatedAction.characterId, sceneDescription,
    )

    // Process items
    if (lootResult.items.length > 0) {
      outcomeItems = []
      for (const grant of lootResult.items) {
        let targetCharIdx = latestChars.findIndex((c) => c.id === grant.characterId)
        if (targetCharIdx === -1) {
          targetCharIdx = latestChars.findIndex((c) => c.id === validatedAction.characterId)
        }
        if (targetCharIdx === -1) targetCharIdx = 0
        const targetChar = latestChars[targetCharIdx]
        if (!targetChar || !grant.item) continue

        const charClone = { ...targetChar, inventory: [...targetChar.inventory] }

        // Normalize item into Equipment
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

        await saveEquipment(equipment)
        console.log('[NarrativeDirector] Equipment saved:', equipment.id, equipment.name)

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

        await saveCharacter(charClone)
        latestChars[targetCharIdx] = charClone
        outcomeItems.push({ name: equipment.name, rarity: equipment.rarity })
      }
      if (outcomeItems.length === 0) outcomeItems = undefined
    }

    // Process gold
    if (lootResult.gold.length > 0) {
      let totalGoldForChar = 0
      for (const gc of lootResult.gold) {
        let charIdx = latestChars.findIndex((c) => c.id === gc.characterId)
        if (charIdx === -1) {
          charIdx = latestChars.findIndex((c) => c.id === validatedAction.characterId)
        }
        if (charIdx === -1) charIdx = 0
        const targetChar = latestChars[charIdx]
        if (!targetChar) continue
        const charClone = { ...targetChar }
        const amount = Number(gc.amount) || 0
        charClone.gold = Math.max(0, (charClone.gold ?? 0) + amount)
        await saveCharacter(charClone)
        latestChars[charIdx] = charClone
        if (charClone.id === validatedAction.characterId) totalGoldForChar += amount
      }
      if (totalGoldForChar !== 0) outcomeGold = totalGoldForChar
    }
  }

  // 3. XP grant on success
  let xpGained = 0
  let levelUp: { character: Character; newLevel: number } | undefined
  if (isSuccess && validatedAction.difficulty > 0) {
    xpGained = validatedAction.difficulty
    const charIdx = latestChars.findIndex((c) => c.id === validatedAction.characterId)
    if (charIdx !== -1) {
      const charClone = { ...latestChars[charIdx] }
      const prevXp = charClone.xp ?? 0
      const prevLevel = charClone.level ?? 1
      const xpNeeded = prevLevel * 100
      const newXp = prevXp + xpGained

      if (newXp >= xpNeeded) {
        charClone.xp = newXp - xpNeeded
        charClone.level = prevLevel + 1
        await saveCharacter(charClone)
        latestChars[charIdx] = charClone
        levelUp = { character: { ...charClone }, newLevel: charClone.level }
      } else {
        charClone.xp = newXp
        await saveCharacter(charClone)
        latestChars[charIdx] = charClone
      }
    }
  }

  const char = currentCharacters.find((c) => c.id === validatedAction.characterId)
  const resolved: ResolvedOutcome = {
    characterId: validatedAction.characterId,
    characterName,
    archetype: char?.archetype ?? '',
    portraitUrl: char?.portraitUrl,
    outcomeText: outcomeNarr.text,
    consequence: outcomeNarr.consequence,
    diceOutcome: outcome,
    rollTotal,
    difficulty: validatedAction.difficulty,
    riskLevel: validatedAction.riskLevel,
    itemsObtained: outcomeItems,
    goldObtained: outcomeGold,
    xpGained: xpGained > 0 ? xpGained : undefined,
  }

  return {
    resolved,
    updatedCharacters: [...latestChars],
    levelUp,
    logEntry,
  }
}

/* ──────────────────────────────────────────────
   Diary Entries
   ────────────────────────────────────────────── */

export type PlayerActionRecord = {
  characterId: string
  actionText: string
  selectedTargetText?: string
  selectedTargetCategory?: string
}

/**
 * Save a diary entry for the completed narrative cycle.
 */
export async function saveCycleDiary(
  worldId: string,
  locationId: string,
  locationName: string,
  sceneTitle: string,
  sceneDescription: string,
  resolvedOutcomes: ResolvedOutcome[],
  playerActionRecords: PlayerActionRecord[],
): Promise<DiaryEntry> {
  const diaryActions: DiaryAction[] = resolvedOutcomes.map((o) => {
    const pa = playerActionRecords.find((a) => a.characterId === o.characterId)
    return {
      characterName: o.characterName,
      archetype: o.archetype,
      portraitUrl: o.portraitUrl,
      targetText: pa?.selectedTargetText,
      targetCategory: pa?.selectedTargetCategory,
      actionText: pa?.actionText ?? o.consequence,
      diceOutcome: o.diceOutcome,
      rollTotal: o.rollTotal,
      outcomeText: o.outcomeText,
      consequence: o.consequence,
      ...(o.itemsObtained?.length ? { itemsObtained: o.itemsObtained } : {}),
      ...(o.goldObtained ? { goldObtained: o.goldObtained } : {}),
    }
  })

  const entry: DiaryEntry = {
    id: `diary-${worldId}-${Date.now()}`,
    worldId,
    locationId,
    locationName,
    sceneTitle,
    sceneDescription,
    actions: diaryActions,
    createdAt: new Date().toISOString(),
  }

  await saveDiaryEntry(entry).catch(() => {})
  return entry
}

/* ──────────────────────────────────────────────
   Outcome Summaries (for next scene generation)
   ────────────────────────────────────────────── */

/**
 * Build outcome summary strings that get passed to the Story Narrator
 * for generating the next scene.
 */
export function buildOutcomeSummaries(outcomes: ResolvedOutcome[]): string[] {
  return outcomes.map((o) => {
    const diffTier = o.difficulty >= 15 ? 'ALTA' : o.difficulty >= 10 ? 'MEDIA' : 'BAIXA'
    const isFail = o.diceOutcome === 'fail' || o.diceOutcome === 'critical-fail'
    const resultLabel = isFail
      ? '*** FALHOU ***'
      : o.diceOutcome === 'partial'
        ? 'PARCIAL'
        : '*** SUCESSO ***'

    return (
      `[${o.characterName} (${o.archetype})] ` +
      `Acao: ${o.consequence}. ` +
      `Dificuldade: ${o.difficulty} (${diffTier}), Risco: ${o.riskLevel}. ` +
      `Dado: ${o.rollTotal} → RESULTADO: ${resultLabel} (${o.diceOutcome}). ` +
      `${isFail ? 'ESTE JOGADOR FRACASSOU — narre como FALHA.' : 'Este jogador teve sucesso.'} ` +
      `Narrativa individual: ${o.outcomeText.replace(/\n/g, ' ').slice(0, 400)}`
    )
  })
}

/* ──────────────────────────────────────────────
   Level-Up Handler
   ────────────────────────────────────────────── */

/**
 * Apply level-up attribute deltas to a character and persist.
 */
export async function applyLevelUp(
  character: Character,
  actionDeltas: Record<keyof ActionAttributes, number>,
  battleDeltas: Record<keyof BattleAttributes, number>,
): Promise<Character> {
  const charClone = { ...character }
  const aa = { ...charClone.actionAttributes }
  for (const key of Object.keys(actionDeltas) as (keyof ActionAttributes)[]) {
    aa[key] = (aa[key] ?? 0) + (actionDeltas[key] ?? 0)
  }
  charClone.actionAttributes = aa

  const ba = { ...charClone.battleAttributes }
  for (const key of Object.keys(battleDeltas) as (keyof BattleAttributes)[]) {
    ba[key] = (ba[key] ?? 0) + (battleDeltas[key] ?? 0)
  }
  charClone.battleAttributes = ba

  await saveCharacter(charClone)
  return charClone
}
