/**
 * Narrative Engine — DEPRECATED COMPATIBILITY LAYER
 *
 * This module now delegates to individual AI agents under services/agents/.
 * All types and functions are re-exported for backward compatibility.
 *
 * @deprecated Import from './agents/...' or './narrativeDirector' instead.
 *
 * Migration guide:
 *   - generateIntroNarration  → narrateIntro  (from agents/storyNarrator)
 *   - generateSceneNarration  → narrateScene  (from agents/storyNarrator)
 *   - generateOutcomeNarration → narrateOutcome (from agents/outcomeNarrator)
 *                                + generateLoot (from agents/lootGenerator)
 *   - validateCustomActions   → validateActions (from agents/actionValidator)
 *   - Types → from agents/shared
 */

import type { Choice, RollOutcome } from '../systems/narrative'

// ── Re-export all shared types ──
export type {
  NarrativeContext,
  NarrativeMood,
  NarrativeResult,
  OutcomeNarrative,
  ValidatedAction,
  CustomActionInput,
  ItemGrant,
  GoldChange,
  LootResult,
} from './agents/shared'

import type {
  NarrativeContext,
  NarrativeResult,
  OutcomeNarrative,
  ValidatedAction,
  CustomActionInput,
} from './agents/shared'

// ── Import agents ──
import { narrateIntro, narrateScene } from './agents/storyNarrator'
import { validateActions } from './agents/actionValidator'
import { narrateOutcome } from './agents/outcomeNarrator'
import { generateLoot } from './agents/lootGenerator'

/* ──────────────────────────────────────────────
   Deprecated compatibility functions
   ────────────────────────────────────────────── */

/**
 * @deprecated Use `narrateIntro` from `./agents/storyNarrator` instead.
 */
export async function generateIntroNarration(
  ctx: NarrativeContext,
): Promise<NarrativeResult> {
  console.warn('[narrativeEngine] generateIntroNarration is deprecated. Use narrateIntro from agents/storyNarrator.')
  return narrateIntro(ctx)
}

/**
 * @deprecated Use `narrateScene` from `./agents/storyNarrator` instead.
 */
export async function generateSceneNarration(
  ctx: NarrativeContext,
  recentOutcomes?: string[],
): Promise<NarrativeResult> {
  console.warn('[narrativeEngine] generateSceneNarration is deprecated. Use narrateScene from agents/storyNarrator.')
  return narrateScene(ctx, recentOutcomes)
}

/**
 * @deprecated Use `narrateOutcome` from `./agents/outcomeNarrator`
 * and `generateLoot` from `./agents/lootGenerator` instead.
 *
 * This wrapper merges outcome + loot into the old combined response shape.
 */
export async function generateOutcomeNarration(
  ctx: NarrativeContext,
  choice: Choice,
  outcome: RollOutcome,
  rollTotal: number,
  characterName?: string,
  _reputationContext?: string,
  _affectsReputation?: boolean,
  affectsInventory = false,
): Promise<OutcomeNarrative> {
  console.warn('[narrativeEngine] generateOutcomeNarration is deprecated. Use narrateOutcome + generateLoot from agents/.')

  // 1. Narrate outcome (text + consequence only)
  const narr = await narrateOutcome(ctx, choice, outcome, rollTotal, characterName)

  // 2. Generate loot if applicable
  const isSuccess = outcome === 'partial' || outcome === 'success' || outcome === 'critical'
  let itemsObtained: OutcomeNarrative['itemsObtained']
  let goldObtained: OutcomeNarrative['goldObtained']

  if (affectsInventory && isSuccess) {
    const loot = await generateLoot(ctx, choice, outcome, rollTotal, undefined)
    if (loot.items.length > 0) {
      itemsObtained = loot.items
    }
    if (loot.gold.length > 0) {
      goldObtained = loot.gold
    }
  }

  return {
    text: narr.text,
    consequence: narr.consequence,
    itemsObtained,
    goldObtained,
  }
}

/**
 * @deprecated Use `validateActions` from `./agents/actionValidator` instead.
 */
export async function validateCustomActions(
  ctx: NarrativeContext,
  actions: CustomActionInput[],
  sceneDescription?: string,
  previousOutcomesSummary?: string,
  _reputationContext?: string,
): Promise<ValidatedAction[]> {
  console.warn('[narrativeEngine] validateCustomActions is deprecated. Use validateActions from agents/actionValidator.')
  return validateActions(ctx, actions, sceneDescription, previousOutcomesSummary)
}

