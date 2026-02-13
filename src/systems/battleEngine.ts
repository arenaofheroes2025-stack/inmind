/**
 * Battle Engine — Pure logic functions for tactical turn-based combat.
 *
 * Responsibilities:
 * - Create / initialize battle state from characters + enemies
 * - Turn order, movement (BFS on 5x5 grid), range, damage
 * - Applying actions: move, attack, defend, skill, item, flee, end-turn
 * - Status effect processing (DoTs, HoTs, buff/debuff expiration)
 * - Enemy AI decision-making (pure logic — no API calls)
 * - Victory/defeat detection and reward calculation
 * - Dice roll bonuses (d20 strategic resource)
 *
 * All functions are pure: they receive state and return updated state.
 */

import type {
  BattleState,
  BattleCombatant,
  BattleAction,
  BattleAttributes,
  BattleLogEntry,
  BattleRewards,
  BattleSkill,
  Character,
  Enemy,
  EnemyAIPattern,
  GridPosition,
  StatusEffect,
  TileType,
} from '../data/types'
import { createStatusEffect, STATUS_EFFECTS } from '../data/battleEffects'
import { getSkillsForCharacter, mergePersistedSkills, getSkillLevelMultiplier } from '../data/battleSkills'

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */

const GRID_SIZE = 10
const MAX_AP = 3
const PLAYER_DICE_ROLLS = 2
const DEFEND_BONUS = 0.5   // +50% defesa
const MIN_DAMAGE = 1
const BASE_DICE_DIFFICULTY = 15

/* ══════════════════════════════════════════════
   Utility — Dice
   ══════════════════════════════════════════════ */

/** Roll a d6 (1-6) */
function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1
}

/** Roll a d20 (1-20) */
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

/* ══════════════════════════════════════════════
   Grid Helpers
   ══════════════════════════════════════════════ */

/** Manhattan distance between two positions */
export function manhattan(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
}

/** Check if a position is inside the grid */
function inBounds(pos: GridPosition): boolean {
  return pos.col >= 0 && pos.col < GRID_SIZE && pos.row >= 0 && pos.row < GRID_SIZE
}

/** Get adjacent (orthogonal + diagonal) positions */
function getNeighbors(pos: GridPosition): GridPosition[] {
  const dirs = [
    { col: 0, row: -1 }, { col: 0, row: 1 }, { col: -1, row: 0 }, { col: 1, row: 0 },
    { col: -1, row: -1 }, { col: 1, row: -1 }, { col: -1, row: 1 }, { col: 1, row: 1 },
  ]
  return dirs.map((d) => ({ col: pos.col + d.col, row: pos.row + d.row })).filter(inBounds)
}

/** Positions occupied by combatants (alive) */
function occupiedPositions(state: BattleState): Set<string> {
  const set = new Set<string>()
  for (const c of state.combatants) {
    if (c.hp > 0) set.add(posKey(c.position))
  }
  return set
}

function posKey(p: GridPosition): string {
  return `${p.col},${p.row}`
}

function parseKey(k: string): GridPosition {
  const [col, row] = k.split(',').map(Number)
  return { col, row }
}

/** BFS-based reachable tiles from a position within maxSteps (1 tile = 1 AP) */
export function getMovementRange(
  state: BattleState,
  from: GridPosition,
  maxSteps: number,
): GridPosition[] {
  const occupied = occupiedPositions(state)
  occupied.delete(posKey(from)) // can start from own tile

  const visited = new Set<string>([posKey(from)])
  const result: GridPosition[] = []
  let frontier: GridPosition[] = [from]

  for (let step = 0; step < maxSteps; step++) {
    const next: GridPosition[] = []
    for (const pos of frontier) {
      for (const nb of getNeighbors(pos)) {
        const key = posKey(nb)
        if (visited.has(key)) continue
        visited.add(key)
        const tile = state.terrain[nb.row]?.[nb.col]
        if (tile === 'blocked') continue
        if (occupied.has(key)) continue
        result.push(nb)
        next.push(nb)
      }
    }
    frontier = next
  }
  return result
}

/** Tiles within attack/skill range (straight-line manhattan, ignores obstacles for ranged) */
export function getAttackRange(
  state: BattleState,
  from: GridPosition,
  range: number,
): GridPosition[] {
  const result: GridPosition[] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const pos = { col: c, row: r }
      const dist = manhattan(from, pos)
      if (dist >= 1 && dist <= range) {
        result.push(pos)
      }
    }
  }
  return result
}

/** Tiles within AoE radius of a target position */
export function getAoeArea(center: GridPosition, radius: number): GridPosition[] {
  if (radius <= 0) return [center]
  const result: GridPosition[] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (manhattan(center, { col: c, row: r }) <= radius) {
        result.push({ col: c, row: r })
      }
    }
  }
  return result
}

/* ══════════════════════════════════════════════
   Effective Attributes (base + equipment + status)
   ══════════════════════════════════════════════ */

export function getEffectiveAttributes(combatant: BattleCombatant): BattleAttributes {
  const base: BattleAttributes = { ...combatant.battleAttributes }

  // Add equipment bonuses
  for (const attr of Object.keys(base) as (keyof BattleAttributes)[]) {
    base[attr] += combatant.equipmentBonuses[attr] ?? 0
  }

  // Apply status effect modifiers (percent-based)
  for (const eff of combatant.statusEffects) {
    if (eff.attribute && eff.percentModifier) {
      base[eff.attribute] = Math.round(base[eff.attribute] * (1 + eff.percentModifier / 100))
    }
    if (eff.attribute && eff.value) {
      base[eff.attribute] += eff.value
    }
  }

  // Defend bonus
  if (combatant.isDefending) {
    base.defesa = Math.round(base.defesa * (1 + DEFEND_BONUS))
  }

  // Ensure no negatives
  for (const attr of Object.keys(base) as (keyof BattleAttributes)[]) {
    if (base[attr] < 0) base[attr] = 0
  }

  return base
}

/* ══════════════════════════════════════════════
   Damage / Healing Calculations
   ══════════════════════════════════════════════ */

function calculateBaseDamage(
  attackerAttrs: BattleAttributes,
  defenderAttrs: BattleAttributes,
  skill?: BattleSkill,
): number {
  if (!skill?.damage) {
    // Basic attack
    const raw = attackerAttrs.ataque - defenderAttrs.defesa * 0.5 + rollD6()
    return Math.max(MIN_DAMAGE, Math.round(raw))
  }

  const scaledAttr = attackerAttrs[skill.damage.attribute]
  const raw =
    skill.damage.base +
    scaledAttr * skill.damage.scaling -
    defenderAttrs.defesa * 0.3 +
    rollD6()

  const levelMult = getSkillLevelMultiplier(skill.level)
  return Math.max(MIN_DAMAGE, Math.round(raw * levelMult))
}

function calculateHealing(skill: BattleSkill, casterAttrs: BattleAttributes): number {
  if (!skill.healing) return 0
  const base = skill.healing + casterAttrs.magia * 0.3
  return Math.round(base * getSkillLevelMultiplier(skill.level))
}

/* ══════════════════════════════════════════════
   Battle Creation
   ══════════════════════════════════════════════ */

/** Generate a 10x10 terrain grid with random hazards/cover */
function generateTerrain(): TileType[][] {
  const grid: TileType[][] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    const row: TileType[] = []
    for (let c = 0; c < GRID_SIZE; c++) {
      const roll = Math.random()
      if (roll < 0.08) row.push('cover')
      else if (roll < 0.12) row.push('blocked')
      else if (roll < 0.15) row.push('hazard')
      else row.push('normal')
    }
    grid.push(row)
  }
  // Ensure center area is clear (hero spawns: rows 3-6, cols 3-6)
  for (let r = 3; r <= 6; r++) {
    for (let c = 3; c <= 6; c++) {
      if (grid[r][c] === 'blocked') grid[r][c] = 'normal'
    }
  }
  // Ensure edge tiles are walkable (enemy spawns)
  for (let i = 0; i < GRID_SIZE; i++) {
    if (grid[0][i] === 'blocked') grid[0][i] = 'normal'
    if (grid[GRID_SIZE - 1][i] === 'blocked') grid[GRID_SIZE - 1][i] = 'normal'
    if (grid[i][0] === 'blocked') grid[i][0] = 'normal'
    if (grid[i][GRID_SIZE - 1] === 'blocked') grid[i][GRID_SIZE - 1] = 'normal'
  }
  return grid
}

/** Create a BattleCombatant from a Character */
function characterToCombatant(char: Character, position: GridPosition): BattleCombatant {
  // Compute equipment battle bonuses from equipped items
  const equipBonuses: Partial<BattleAttributes> = {}
  const equippedIds = Object.values(char.equippedItems ?? {}).filter(Boolean)
  for (const inv of char.inventory ?? []) {
    if (equippedIds.includes(inv.equipmentId)) {
      // Equipment bonuses would come from the Equipment data — here we use what the character has
    }
  }

  const battleSkills = char.battleSkills ?? []
  const skills = battleSkills.length > 0
    ? mergePersistedSkills(char.archetype, char.level, battleSkills)
    : getSkillsForCharacter(char.archetype, char.level)

  return {
    id: `player-${char.id}`,
    name: char.name,
    team: 'player',
    position,
    hp: char.hp,
    maxHp: 20 + char.level * 5 + (char.battleAttributes?.defesa ?? 0) * 2,
    battleAttributes: {
      ataque: 10, defesa: 10, velocidade: 10, magia: 10,
      ...(char.battleAttributes ?? {}),
    },
    equipmentBonuses: equipBonuses,
    statusEffects: [],
    actionPoints: MAX_AP,
    maxActionPoints: MAX_AP,
    skills: skills.map((s) => ({ ...s, currentUses: s.maxUsesPerBattle })),
    isDefending: false,
    hasAttacked: false,
    hasDefended: false,
    diceRollsRemaining: PLAYER_DICE_ROLLS,
    portraitUrl: char.portraitUrl,
    sourceId: char.id,
  }
}

/** Create a BattleCombatant from an Enemy */
function enemyToCombatant(enemy: Enemy, position: GridPosition, index: number): BattleCombatant {
  return {
    id: `enemy-${enemy.id}-${index}`,
    name: enemy.name,
    team: 'enemy',
    position,
    hp: enemy.maxHp || enemy.hp,
    maxHp: enemy.maxHp || enemy.hp,
    battleAttributes: enemy.battleAttributes ?? {
      velocidade: 5 + enemy.level * 2,
      ataque: 5 + enemy.level * 2,
      defesa: 3 + enemy.level,
      magia: 3 + enemy.level,
    },
    equipmentBonuses: {},
    statusEffects: [],
    actionPoints: MAX_AP,
    maxActionPoints: MAX_AP,
    skills: (enemy.skills ?? []).map((s) => ({ ...s, currentUses: s.maxUsesPerBattle })),
    isDefending: false,
    hasAttacked: false,
    hasDefended: false,
    diceRollsRemaining: 0, // enemies don't get dice rolls
    portraitUrl: enemy.portraitUrl,
    sourceId: enemy.id,
  }
}

/** Shuffle array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Pick N unique random positions from a pool, avoiding occupied tiles */
function pickRandomPositions(
  pool: GridPosition[],
  count: number,
  occupied: Set<string>,
): GridPosition[] {
  const available = shuffle(pool.filter((p) => !occupied.has(`${p.col},${p.row}`)))
  return available.slice(0, count)
}

/** Center area positions (rows 3-6, cols 3-6) for hero spawns */
function getCenterPositions(): GridPosition[] {
  const positions: GridPosition[] = []
  for (let r = 3; r <= 6; r++) {
    for (let c = 3; c <= 6; c++) {
      positions.push({ col: c, row: r })
    }
  }
  return positions
}

/** Edge/perimeter positions for enemy spawns (distributed around the board) */
function getEdgePositions(): GridPosition[] {
  const positions: GridPosition[] = []
  for (let i = 0; i < GRID_SIZE; i++) {
    positions.push({ col: i, row: 0 })           // top edge
    positions.push({ col: i, row: GRID_SIZE - 1 }) // bottom edge
    if (i > 0 && i < GRID_SIZE - 1) {
      positions.push({ col: 0, row: i })           // left edge
      positions.push({ col: GRID_SIZE - 1, row: i }) // right edge
    }
  }
  return positions
}

/** Initialize a new battle */
export function createBattle(
  worldId: string,
  locationId: string,
  characters: Character[],
  enemies: Enemy[],
): BattleState {
  const terrain = generateTerrain()
  const occupied = new Set<string>()

  // Pick random center positions for heroes
  const heroPositions = pickRandomPositions(getCenterPositions(), Math.min(characters.length, 4), occupied)
  heroPositions.forEach((p) => occupied.add(`${p.col},${p.row}`))

  // Pick random edge positions for enemies
  const enemyPositions = pickRandomPositions(getEdgePositions(), Math.min(enemies.length, 4), occupied)
  enemyPositions.forEach((p) => occupied.add(`${p.col},${p.row}`))

  const playerCombatants = characters
    .slice(0, 4)
    .map((c, i) => characterToCombatant(c, heroPositions[i] ?? { col: 4 + i, row: 5 }))

  const enemyCombatants = enemies
    .slice(0, 4)
    .map((e, i) => enemyToCombatant(e, enemyPositions[i] ?? { col: i, row: 0 }, i))

  const combatants = [...playerCombatants, ...enemyCombatants]
  const turnOrder = calculateTurnOrder(combatants)

  return {
    id: crypto.randomUUID(),
    worldId,
    locationId,
    combatants,
    turnOrder,
    currentTurnIndex: 0,
    round: 1,
    phase: 'intro',
    actionLog: [],
    terrain,
    updatedAt: new Date().toISOString(),
  }
}

/** Sort combatants by velocidade (descending) */
export function calculateTurnOrder(combatants: BattleCombatant[]): string[] {
  return combatants
    .filter((c) => c.hp > 0)
    .sort((a, b) => {
      const aSpd = getEffectiveAttributes(a).velocidade
      const bSpd = getEffectiveAttributes(b).velocidade
      if (bSpd !== aSpd) return bSpd - aSpd
      // Tie-breaker: players go first, then alphabetical
      if (a.team !== b.team) return a.team === 'player' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((c) => c.id)
}

/* ══════════════════════════════════════════════
   Turn Management
   ══════════════════════════════════════════════ */

/** Get the combatant whose turn it is */
export function getCurrentCombatant(state: BattleState): BattleCombatant | undefined {
  const id = state.turnOrder[state.currentTurnIndex]
  return state.combatants.find((c) => c.id === id)
}

/** Advance to next turn, applying start-of-turn effects */
export function advanceTurn(state: BattleState): BattleState {
  let next = { ...state, combatants: state.combatants.map((c) => ({ ...c })) }

  // Move to next combatant
  let nextIndex = (next.currentTurnIndex + 1) % next.turnOrder.length
  let newRound = next.round

  // If wrapped around, new round
  if (nextIndex === 0) {
    newRound++
    // Recalculate turn order for new round
    next.turnOrder = calculateTurnOrder(next.combatants)
    nextIndex = 0
  }

  next.currentTurnIndex = nextIndex
  next.round = newRound

  // Skip dead combatants
  let attempts = 0
  while (attempts < next.turnOrder.length) {
    const turnCombatant = next.combatants.find((c) => c.id === next.turnOrder[next.currentTurnIndex])
    if (turnCombatant && turnCombatant.hp > 0) break
    next.currentTurnIndex = (next.currentTurnIndex + 1) % next.turnOrder.length
    attempts++
  }

  // Apply start-of-turn effects for the new combatant
  next = applyStartOfTurnEffects(next)

  // Reset AP and flags for the new combatant
  const newCurrent = getCurrentCombatant(next)
  if (newCurrent) {
    newCurrent.actionPoints = newCurrent.maxActionPoints
    newCurrent.hasAttacked = false
    newCurrent.hasDefended = false
    newCurrent.isDefending = false // defense buff expires at start of own turn
    // Check for stun
    const stunned = newCurrent.statusEffects.find((e) => e.id === 'atordoado')
    if (stunned) {
      newCurrent.actionPoints = 0
      next.actionLog.push({
        round: next.round,
        actorId: newCurrent.id,
        actorName: newCurrent.name,
        actionType: 'move', // using move as "skip"
        text: `${newCurrent.name} está atordoado e perde o turno!`,
      })
    }
  }

  // Set phase based on team
  if (newCurrent) {
    next.phase = newCurrent.team === 'player' ? 'player-turn' : 'enemy-turn'
  }

  next.updatedAt = new Date().toISOString()
  return next
}

/* ══════════════════════════════════════════════
   Status Effect Processing
   ══════════════════════════════════════════════ */

/** Apply DoTs, HoTs, decrement durations at start of a combatant's turn */
function applyStartOfTurnEffects(state: BattleState): BattleState {
  const combatant = getCurrentCombatant(state)
  if (!combatant) return state

  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c, statusEffects: [...c.statusEffects] })) }
  const target = next.combatants.find((c) => c.id === combatant.id)!

  const expiredEffects: string[] = []

  target.statusEffects = target.statusEffects
    .map((eff) => {
      const updated = { ...eff }

      // DoT damage
      if (eff.damagePerTurn && eff.damagePerTurn > 0) {
        const totalDmg = eff.damagePerTurn * (eff.currentStacks ?? 1)
        target.hp = Math.max(0, target.hp - totalDmg)
        next.actionLog.push({
          round: next.round,
          actorId: target.id,
          actorName: target.name,
          actionType: 'dot',
          damage: totalDmg,
          statusApplied: eff.name,
          text: `${target.name} sofre ${totalDmg} de dano de ${eff.name}!`,
        })
      }

      // HoT healing
      if (eff.healPerTurn && eff.healPerTurn > 0) {
        const totalHeal = eff.healPerTurn * (eff.currentStacks ?? 1)
        target.hp = Math.min(target.maxHp, target.hp + totalHeal)
        next.actionLog.push({
          round: next.round,
          actorId: target.id,
          actorName: target.name,
          actionType: 'hot',
          healing: totalHeal,
          statusApplied: eff.name,
          text: `${target.name} recupera ${totalHeal} HP com ${eff.name}.`,
        })
      }

      // Decrement duration
      if (updated.duration > 0) {
        updated.duration--
        if (updated.duration <= 0) {
          expiredEffects.push(eff.name)
          return null
        }
      }

      return updated
    })
    .filter(Boolean) as StatusEffect[]

  return next
}

/** Apply a status effect to a combatant, handling stacking rules */
export function applyStatusEffect(
  combatant: BattleCombatant,
  effectId: string,
): BattleCombatant {
  const template = STATUS_EFFECTS[effectId]
  if (!template) return combatant

  const updated = { ...combatant, statusEffects: [...combatant.statusEffects] }
  const existing = updated.statusEffects.find((e) => e.id === effectId)

  if (existing) {
    if (template.stackable && existing.currentStacks != null && template.maxStacks != null) {
      // Add a stack
      existing.currentStacks = Math.min(existing.currentStacks + 1, template.maxStacks)
      existing.duration = template.duration // refresh duration
    } else {
      // Refresh duration
      existing.duration = template.duration
    }
  } else {
    const fresh = createStatusEffect(effectId)
    if (fresh) {
      updated.statusEffects.push(fresh)
    }
  }

  return updated
}

/* ══════════════════════════════════════════════
   Action Execution
   ══════════════════════════════════════════════ */

/** Execute a battle action and return updated state + log entries */
export function executeAction(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'move':
      return executeMove(state, action)
    case 'attack':
      return executeAttack(state, action)
    case 'defend':
      return executeDefend(state, action)
    case 'skill':
      return executeSkill(state, action)
    case 'item':
      return executeItem(state, action)
    case 'flee':
      return executeFlee(state, action)
    case 'end-turn':
      return executeEndTurn(state, action)
    default:
      return state
  }
}

function executeMove(state: BattleState, action: BattleAction): BattleState {
  if (!action.targetPosition) return state

  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c })) }
  const actor = next.combatants.find((c) => c.id === action.actorId)
  if (!actor || actor.actionPoints < 1) return state

  // Check if enraizado
  if (actor.statusEffects.some((e) => e.id === 'enraizado')) {
    next.actionLog.push({
      round: next.round, actorId: actor.id, actorName: actor.name,
      actionType: 'move',
      text: `${actor.name} está enraizado e não pode se mover!`,
    })
    return next
  }

  const reachable = getMovementRange(state, actor.position, actor.actionPoints)
  const targetKey = posKey(action.targetPosition)
  if (!reachable.some((p) => posKey(p) === targetKey)) return state

  // AP cost = manhattan distance (1 tile = 1 AP)
  const tilesWalked = manhattan(actor.position, action.targetPosition)
  actor.position = { ...action.targetPosition }
  actor.actionPoints = Math.max(0, actor.actionPoints - tilesWalked)

  // Hazard tile damage
  const tile = next.terrain[action.targetPosition.row]?.[action.targetPosition.col]
  if (tile === 'hazard') {
    const hazardDmg = 3
    actor.hp = Math.max(0, actor.hp - hazardDmg)
    next.actionLog.push({
      round: next.round, actorId: actor.id, actorName: actor.name,
      actionType: 'move', damage: hazardDmg,
      text: `${actor.name} pisa em terreno perigoso e sofre ${hazardDmg} de dano!`,
    })
  }

  next.actionLog.push({
    round: next.round, actorId: actor.id, actorName: actor.name,
    actionType: 'move',
    text: `${actor.name} se move para (${action.targetPosition.col}, ${action.targetPosition.row}).`,
  })

  next.updatedAt = new Date().toISOString()
  return next
}

function executeAttack(state: BattleState, action: BattleAction): BattleState {
  if (!action.targetId) return state

  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c, statusEffects: [...c.statusEffects] })) }
  const actor = next.combatants.find((c) => c.id === action.actorId)
  const target = next.combatants.find((c) => c.id === action.targetId)
  if (!actor || !target || actor.actionPoints < 1) return state

  // Rule: only 1 attack/skill per turn
  if (actor.hasAttacked) return state
  // Rule: can't attack if already defended
  if (actor.hasDefended) return state

  // Range check (melee = 1)
  if (manhattan(actor.position, target.position) > 1) return state

  const attackerAttrs = getEffectiveAttributes(actor)
  const defenderAttrs = getEffectiveAttributes(target)
  const damage = calculateBaseDamage(attackerAttrs, defenderAttrs)

  target.hp = Math.max(0, target.hp - damage)
  actor.actionPoints -= 1
  actor.hasAttacked = true

  const isKill = target.hp <= 0
  next.actionLog.push({
    round: next.round, actorId: actor.id, actorName: actor.name,
    actionType: 'attack', targetId: target.id, targetName: target.name,
    damage, isKill,
    text: `${actor.name} ataca ${target.name} causando ${damage} de dano!${isKill ? ` ${target.name} foi derrotado!` : ''}`,
  })

  next.updatedAt = new Date().toISOString()
  return checkBattleEnd(next)
}

function executeDefend(state: BattleState, action: BattleAction): BattleState {
  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c })) }
  const actor = next.combatants.find((c) => c.id === action.actorId)
  if (!actor) return state

  // Rule: can't defend if already attacked/used skill, or no AP, or already defended
  if (actor.hasAttacked) return state
  if (actor.hasDefended) return state
  if (actor.actionPoints < 1) return state

  actor.isDefending = true
  actor.hasDefended = true
  actor.actionPoints = Math.max(0, actor.actionPoints - 1) // costs 1 AP

  next.actionLog.push({
    round: next.round, actorId: actor.id, actorName: actor.name,
    actionType: 'defend',
    text: `${actor.name} assume postura defensiva! (+50% defesa até o próximo turno)`,
  })

  next.updatedAt = new Date().toISOString()
  return next
}

function executeSkill(state: BattleState, action: BattleAction): BattleState {
  if (!action.skillId) return state

  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c, statusEffects: [...c.statusEffects], skills: c.skills.map(s => ({ ...s })) })) }
  const actor = next.combatants.find((c) => c.id === action.actorId)
  if (!actor || actor.actionPoints < 1) return state

  // Rule: only 1 attack/skill per turn
  if (actor.hasAttacked) return state
  // Rule: can't use skill if already defended
  if (actor.hasDefended) return state

  const skill = actor.skills.find((s) => s.id === action.skillId)
  if (!skill || skill.currentUses <= 0) return state

  const actorAttrs = getEffectiveAttributes(actor)

  // Determine targets
  let targets: BattleCombatant[] = []

  if (skill.type === 'cura' || skill.type === 'buff') {
    // Friendly targets
    if (action.targetId) {
      const t = next.combatants.find((c) => c.id === action.targetId && c.team === actor.team)
      if (t) targets = [t]
    }
    if (targets.length === 0 && skill.aoeRadius >= 99) {
      // All allies
      targets = next.combatants.filter((c) => c.team === actor.team && c.hp > 0)
    }
    if (targets.length === 0) {
      // Self
      targets = [actor]
    }
  } else {
    // Hostile targets
    if (action.targetId) {
      const t = next.combatants.find((c) => c.id === action.targetId)
      if (t) {
        if (skill.aoeRadius > 0) {
          const area = getAoeArea(t.position, skill.aoeRadius)
          targets = next.combatants.filter(
            (c) => c.hp > 0 && c.team !== actor.team &&
            area.some((a) => posKey(a) === posKey(c.position)),
          )
        } else {
          targets = [t]
        }
      }
    }
    // Debuffs can also target enemies in AoE
    if (skill.type === 'debuff' && targets.length === 0 && action.targetId) {
      const t = next.combatants.find((c) => c.id === action.targetId)
      if (t) {
        if (skill.aoeRadius > 0) {
          const area = getAoeArea(t.position, skill.aoeRadius)
          targets = next.combatants.filter(
            (c) => c.hp > 0 && c.team !== actor.team &&
            area.some((a) => posKey(a) === posKey(c.position)),
          )
        } else {
          targets = [t]
        }
      }
    }
  }

  if (targets.length === 0 && skill.type === 'controle') {
    // Control skills: target specific enemy
    if (action.targetId) {
      const t = next.combatants.find((c) => c.id === action.targetId)
      if (t) targets = [t]
    }
  }

  // Range check for the primary target
  if (targets.length > 0) {
    const primaryTarget = action.targetId
      ? next.combatants.find((c) => c.id === action.targetId)
      : targets[0]
    if (primaryTarget && manhattan(actor.position, primaryTarget.position) > skill.range) {
      return state // Out of range
    }
  }

  // Apply the skill
  skill.currentUses--
  skill.usageCount = (skill.usageCount || 0) + 1
  actor.actionPoints -= skill.apCost
  actor.hasAttacked = true

  for (const target of targets) {
    const targetIdx = next.combatants.findIndex((c) => c.id === target.id)
    if (targetIdx === -1) continue

    // Damage
    if (skill.damage) {
      const defAttrs = getEffectiveAttributes(target)
      const dmg = calculateBaseDamage(actorAttrs, defAttrs, skill)
      next.combatants[targetIdx].hp = Math.max(0, target.hp - dmg)
      const isKill = next.combatants[targetIdx].hp <= 0

      next.actionLog.push({
        round: next.round, actorId: actor.id, actorName: actor.name,
        actionType: 'skill', targetId: target.id, targetName: target.name,
        damage: dmg, skillName: skill.name, isKill,
        text: `${actor.name} usa ${skill.name} em ${target.name} causando ${dmg} de dano!${isKill ? ` ${target.name} foi derrotado!` : ''}`,
      })
    }

    // Healing
    if (skill.healing && skill.healing > 0) {
      const heal = calculateHealing(skill, actorAttrs)
      next.combatants[targetIdx].hp = Math.min(target.maxHp, target.hp + heal)

      next.actionLog.push({
        round: next.round, actorId: actor.id, actorName: actor.name,
        actionType: 'skill', targetId: target.id, targetName: target.name,
        healing: heal, skillName: skill.name,
        text: `${actor.name} usa ${skill.name} em ${target.name} restaurando ${heal} HP!`,
      })
    }

    // Status effect
    if (skill.statusApply) {
      if (Math.random() < skill.statusApply.chance) {
        next.combatants[targetIdx] = applyStatusEffect(next.combatants[targetIdx], skill.statusApply.effectId)
        const effName = STATUS_EFFECTS[skill.statusApply.effectId]?.name ?? skill.statusApply.effectId

        next.actionLog.push({
          round: next.round, actorId: actor.id, actorName: actor.name,
          actionType: 'skill', targetId: target.id, targetName: target.name,
          statusApplied: effName, skillName: skill.name,
          text: `${target.name} recebe o efeito ${effName}!`,
        })
      }
    }

    // If skill has no damage, no healing, and no status (pure control like teleport)
    if (!skill.damage && !skill.healing && !skill.statusApply) {
      next.actionLog.push({
        round: next.round, actorId: actor.id, actorName: actor.name,
        actionType: 'skill', skillName: skill.name,
        text: `${actor.name} usa ${skill.name}!`,
      })
    }
  }

  next.updatedAt = new Date().toISOString()
  return checkBattleEnd(next)
}

function executeItem(state: BattleState, action: BattleAction): BattleState {
  // Item usage in battle — basic implementation for potions
  if (!action.itemId) return state

  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c })) }
  const actor = next.combatants.find((c) => c.id === action.actorId)
  if (!actor || actor.actionPoints < 1) return state

  // We'll consume 1 AP for item use
  actor.actionPoints -= 1

  next.actionLog.push({
    round: next.round, actorId: actor.id, actorName: actor.name,
    actionType: 'item',
    text: `${actor.name} usa um item.`,
  })

  next.updatedAt = new Date().toISOString()
  return next
}

function executeFlee(state: BattleState, action: BattleAction): BattleState {
  const next = { ...state }
  const actor = next.combatants.find((c) => c.id === action.actorId)
  if (!actor) return state

  // 30% base chance + velocidade bonus
  const attrs = getEffectiveAttributes(actor)
  const fleeChance = 0.3 + attrs.velocidade * 0.02
  const success = Math.random() < fleeChance

  if (success) {
    next.phase = 'defeat' // Flee counts as retreat
    next.actionLog.push({
      round: next.round, actorId: actor.id, actorName: actor.name,
      actionType: 'flee',
      text: `${actor.name} foge da batalha!`,
    })
  } else {
    actor.actionPoints = 0
    next.actionLog.push({
      round: next.round, actorId: actor.id, actorName: actor.name,
      actionType: 'flee',
      text: `${actor.name} tenta fugir mas não consegue!`,
    })
  }

  next.updatedAt = new Date().toISOString()
  return next
}

function executeEndTurn(state: BattleState, action: BattleAction): BattleState {
  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c })) }
  const actor = next.combatants.find((c) => c.id === action.actorId)
  if (!actor) return state

  actor.actionPoints = 0

  next.updatedAt = new Date().toISOString()
  return next
}

/* ══════════════════════════════════════════════
   Dice Roll (Strategic Resource)
   ══════════════════════════════════════════════ */

export type DiceRollResult = {
  roll: number
  difficulty: number
  success: boolean
  isCrit: boolean
  isCritFail: boolean
  bonusDamage: number
  bonusHealing: number
  bonusDefense: number
}

/**
 * Use a dice roll for a specific purpose. Players have 2 per battle.
 * - difficulty = 15 - (relevantAttribute / 3)
 * - success = roll >= difficulty
 * - crit = roll == 20, critFail = roll == 1
 * - bonuses: +50% damage on success, +100% on crit; -50% on fail
 */
export function performDiceRoll(
  combatant: BattleCombatant,
  purpose: 'attack' | 'defense' | 'skill' | 'move',
): DiceRollResult {
  const attrs = getEffectiveAttributes(combatant)
  let relevantAttr: number
  switch (purpose) {
    case 'attack': relevantAttr = attrs.ataque; break
    case 'defense': relevantAttr = attrs.defesa; break
    case 'skill': relevantAttr = attrs.magia; break
    case 'move': relevantAttr = attrs.agilidade; break
    default: relevantAttr = 10
  }

  const difficulty = Math.max(5, Math.round(BASE_DICE_DIFFICULTY - relevantAttr / 3))
  const roll = rollD20()
  const isCrit = roll === 20
  const isCritFail = roll === 1
  const success = isCrit || (!isCritFail && roll >= difficulty)

  return {
    roll,
    difficulty,
    success,
    isCrit,
    isCritFail,
    bonusDamage: isCrit ? 2.0 : success ? 1.5 : isCritFail ? 0.5 : 0.75,
    bonusHealing: isCrit ? 2.0 : success ? 1.5 : 1.0,
    bonusDefense: isCrit ? 2.0 : success ? 1.5 : isCritFail ? 0.5 : 1.0,
  }
}

/** Apply dice roll result to a battle action's damage/healing */
export function applyDiceRollToAction(
  state: BattleState,
  actorId: string,
  result: DiceRollResult,
  lastLogIndex?: number,
): BattleState {
  const next = { ...state, combatants: state.combatants.map((c) => ({ ...c })) }
  const actor = next.combatants.find((c) => c.id === actorId)
  if (!actor) return state

  actor.diceRollsRemaining = Math.max(0, actor.diceRollsRemaining - 1)

  // Modify the last relevant log entry's damage/healing
  if (lastLogIndex != null && next.actionLog[lastLogIndex]) {
    const entry = { ...next.actionLog[lastLogIndex] }
    if (entry.damage) {
      entry.damage = Math.max(1, Math.round(entry.damage * result.bonusDamage))
      entry.isCrit = result.isCrit
    }
    if (entry.healing) {
      entry.healing = Math.round(entry.healing * result.bonusHealing)
    }
    next.actionLog[lastLogIndex] = entry

    // Re-apply the modified damage/healing to the target
    if (entry.targetId && entry.damage) {
      const target = next.combatants.find((c) => c.id === entry.targetId)
      if (target) {
        // We need to undo and redo: for simplicity, add the bonus damage
        const originalDmg = next.actionLog[lastLogIndex].damage!
        const bonusDmg = entry.damage - originalDmg
        if (bonusDmg !== 0) {
          target.hp = Math.max(0, target.hp - bonusDmg)
        }
      }
    }
  }

  next.actionLog.push({
    round: next.round, actorId: actor.id, actorName: actor.name,
    actionType: 'dice',
    isCrit: result.isCrit,
    text: result.isCrit
      ? `🎲 ${actor.name} rola um 20 CRÍTICO! (d20: ${result.roll} vs DC ${result.difficulty})`
      : result.isCritFail
      ? `🎲 ${actor.name} rola uma FALHA CRÍTICA! (d20: ${result.roll} vs DC ${result.difficulty})`
      : result.success
      ? `🎲 ${actor.name} obtém sucesso! (d20: ${result.roll} vs DC ${result.difficulty})`
      : `🎲 ${actor.name} falha no teste. (d20: ${result.roll} vs DC ${result.difficulty})`,
  })

  next.updatedAt = new Date().toISOString()
  return checkBattleEnd(next)
}

/* ══════════════════════════════════════════════
   Victory / Defeat Detection
   ══════════════════════════════════════════════ */

export function checkBattleEnd(state: BattleState): BattleState {
  if (state.phase === 'victory' || state.phase === 'defeat') return state

  const playersAlive = state.combatants.some((c) => c.team === 'player' && c.hp > 0)
  const enemiesAlive = state.combatants.some((c) => c.team === 'enemy' && c.hp > 0)

  if (!enemiesAlive) {
    return {
      ...state,
      phase: 'victory',
      rewards: calculateRewards(state),
      updatedAt: new Date().toISOString(),
    }
  }

  if (!playersAlive) {
    return {
      ...state,
      phase: 'defeat',
      updatedAt: new Date().toISOString(),
    }
  }

  return state
}

/** Calculate XP, gold, and item rewards from defeated enemies */
export function calculateRewards(state: BattleState): BattleRewards {
  const defeated = state.combatants.filter((c) => c.team === 'enemy' && c.hp <= 0)

  let xp = 0
  let gold = 0
  const items: BattleRewards['items'] = []

  for (const enemy of defeated) {
    // Base XP: 10 * level, bonus for difficulty
    xp += 10 * Math.max(1, Math.round(enemy.maxHp / 10))
    gold += 5 + Math.round(Math.random() * 10 * Math.max(1, enemy.maxHp / 20))
  }

  // Bonus for survival (fewer rounds = more XP)
  if (state.round <= 3) xp = Math.round(xp * 1.2)
  if (state.round <= 5) xp = Math.round(xp * 1.1)

  return { xp, gold, items }
}

/* ══════════════════════════════════════════════
   Enemy AI (Pure Logic — No API Cost!)
   ══════════════════════════════════════════════ */

/**
 * Decide the best action for an AI-controlled enemy.
 *
 * Patterns:
 * - agressivo: prioritize attacks/damage, target weakest player
 * - defensivo: defend when HP < 50%, buff self, attack when safe
 * - tatico: use skills strategically, target highest-threat player
 * - covarde: flee when HP < 30%, otherwise attack from range
 */
export function getEnemyAction(state: BattleState, enemyId: string): BattleAction[] {
  const enemy = state.combatants.find((c) => c.id === enemyId)
  if (!enemy || enemy.hp <= 0) return []

  const players = state.combatants.filter((c) => c.team === 'player' && c.hp > 0)
  if (players.length === 0) return []

  // Determine AI pattern from original enemy or default
  const pattern: EnemyAIPattern = 'agressivo' // default; real pattern comes from Enemy.aiPattern

  const actions: BattleAction[] = []
  let ap = enemy.actionPoints

  switch (pattern) {
    case 'agressivo':
      return getAggressiveActions(state, enemy, players, ap)
    case 'defensivo':
      return getDefensiveActions(state, enemy, players, ap)
    case 'tatico':
      return getTacticalActions(state, enemy, players, ap)
    case 'covarde':
      return getCowardActions(state, enemy, players, ap)
    default:
      return getAggressiveActions(state, enemy, players, ap)
  }
}

function getAggressiveActions(
  state: BattleState,
  enemy: BattleCombatant,
  players: BattleCombatant[],
  ap: number,
): BattleAction[] {
  const actions: BattleAction[] = []
  let hasAttacked = false

  // Target: weakest player (lowest HP)
  const target = [...players].sort((a, b) => a.hp - b.hp)[0]

  while (ap > 0) {
    const dist = manhattan(enemy.position, target.position)

    // Rule: only 1 attack/skill per turn
    if (!hasAttacked) {
      // Try to use a damaging skill first
      const dmgSkill = enemy.skills.find(
        (s) => s.currentUses > 0 && (s.type === 'ataque' || s.type === 'aoe') && s.range >= dist,
      )
      if (dmgSkill) {
        actions.push({ type: 'skill', actorId: enemy.id, targetId: target.id, skillId: dmgSkill.id })
        ap -= dmgSkill.apCost
        hasAttacked = true
        continue
      }

      // If in melee range, basic attack
      if (dist <= 1) {
        actions.push({ type: 'attack', actorId: enemy.id, targetId: target.id })
        ap--
        hasAttacked = true
        continue
      }
    }

    // Already attacked or not in range — move toward the target
    if (!hasAttacked && dist > 1) {
      const reachable = getMovementRange(state, enemy.position, ap)
      if (reachable.length > 0) {
        const closest = reachable
          .sort((a, b) => manhattan(a, target.position) - manhattan(b, target.position))[0]
        const cost = manhattan(enemy.position, closest)
        actions.push({ type: 'move', actorId: enemy.id, targetPosition: closest })
        ap -= cost
      } else {
        break
      }
    } else {
      // Already attacked and has AP left — just end
      break
    }
  }

  return actions
}

function getDefensiveActions(
  state: BattleState,
  enemy: BattleCombatant,
  players: BattleCombatant[],
  ap: number,
): BattleAction[] {
  const actions: BattleAction[] = []
  const hpPercent = enemy.hp / enemy.maxHp

  // If HP < 50%, defend
  if (hpPercent < 0.5) {
    // Try healing skill first
    const healSkill = enemy.skills.find((s) => s.currentUses > 0 && s.type === 'cura')
    if (healSkill) {
      actions.push({ type: 'skill', actorId: enemy.id, targetId: enemy.id, skillId: healSkill.id })
      return actions
    }

    // Try buff
    const buffSkill = enemy.skills.find((s) => s.currentUses > 0 && s.type === 'buff')
    if (buffSkill) {
      actions.push({ type: 'skill', actorId: enemy.id, targetId: enemy.id, skillId: buffSkill.id })
      ap -= buffSkill.apCost
    }

    actions.push({ type: 'defend', actorId: enemy.id })
    return actions
  }

  // Otherwise, attack cautiously (one attack per turn)
  return getAggressiveActions(state, enemy, players, Math.min(ap, 2))
}

function getTacticalActions(
  state: BattleState,
  enemy: BattleCombatant,
  players: BattleCombatant[],
  ap: number,
): BattleAction[] {
  const actions: BattleAction[] = []

  // Target: highest-threat (most damage potential = highest ataque)
  const target = [...players].sort(
    (a, b) => getEffectiveAttributes(b).ataque - getEffectiveAttributes(a).ataque,
  )[0]

  // Only 1 skill/attack per turn — pick the best one
  // Priority: AoE hitting 2+ > debuff on unaffected target > single-target damage

  // Try AoE if 2+ players are close together
  const aoeSkill = enemy.skills.find((s) => s.currentUses > 0 && s.type === 'aoe')
  if (aoeSkill && ap >= aoeSkill.apCost) {
    for (const p of players) {
      const area = getAoeArea(p.position, aoeSkill.aoeRadius)
      const hits = players.filter((pl) => area.some((a) => posKey(a) === posKey(pl.position)))
      if (hits.length >= 2) {
        actions.push({ type: 'skill', actorId: enemy.id, targetId: p.id, skillId: aoeSkill.id })
        return actions
      }
    }
  }

  // Try debuff if target has no debuffs
  const debuffSkill = enemy.skills.find((s) => s.currentUses > 0 && s.type === 'debuff')
  const targetHasDebuff = target.statusEffects.some((e) => e.type === 'debuff')
  if (debuffSkill && !targetHasDebuff && ap >= debuffSkill.apCost) {
    actions.push({ type: 'skill', actorId: enemy.id, targetId: target.id, skillId: debuffSkill.id })
    return actions
  }

  // Otherwise use aggressive (which also respects 1 attack rule)
  return getAggressiveActions(state, enemy, [target], ap)
}

function getCowardActions(
  state: BattleState,
  enemy: BattleCombatant,
  players: BattleCombatant[],
  ap: number,
): BattleAction[] {
  const hpPercent = enemy.hp / enemy.maxHp

  // Flee if HP < 30%
  if (hpPercent < 0.3) {
    return [{ type: 'flee', actorId: enemy.id }]
  }

  // Try to stay at range and use ranged skills
  const rangedSkill = enemy.skills.find((s) => s.currentUses > 0 && s.range >= 2 && s.damage)
  const target = [...players].sort((a, b) => a.hp - b.hp)[0]

  if (rangedSkill) {
    const actions: BattleAction[] = []
    // If too close, move away first
    if (manhattan(enemy.position, target.position) <= 1 && ap > 0) {
      const reachable = getMovementRange(state, enemy.position, ap)
      const farthest = reachable.sort(
        (a, b) => manhattan(b, target.position) - manhattan(a, target.position),
      )[0]
      if (farthest) {
        const cost = manhattan(enemy.position, farthest)
        actions.push({ type: 'move', actorId: enemy.id, targetPosition: farthest })
        ap -= cost
      }
    }
    if (ap > 0) {
      actions.push({ type: 'skill', actorId: enemy.id, targetId: target.id, skillId: rangedSkill.id })
    }
    return actions
  }

  // Fallback: aggressive
  return getAggressiveActions(state, enemy, players, ap)
}

/* ══════════════════════════════════════════════
   Skill Persistence (level-up after battle)
   ══════════════════════════════════════════════ */

/**
 * After a battle, update a character's battleSkills with usage data.
 * Returns the updated skills array with any level-ups applied.
 */
export function syncBattleSkillsToCharacter(
  combatant: BattleCombatant,
  existingSkills: BattleSkill[],
): BattleSkill[] {
  const map = new Map(existingSkills.map((s) => [s.id, { ...s }]))

  for (const battleSkill of combatant.skills) {
    const existing = map.get(battleSkill.id)
    if (existing) {
      existing.usageCount += battleSkill.usageCount
      // Check level up
      while (
        existing.level < 5 &&
        existing.usageCount >= existing.levelUpThreshold
      ) {
        existing.usageCount -= existing.levelUpThreshold
        existing.level++
        existing.levelUpThreshold = getNextThreshold(existing.level)
      }
      map.set(battleSkill.id, existing)
    } else {
      // New skill learned
      map.set(battleSkill.id, { ...battleSkill })
    }
  }

  return Array.from(map.values())
}

function getNextThreshold(level: number): number {
  switch (level) {
    case 2: return 15
    case 3: return 30
    case 4: return 50
    default: return Infinity
  }
}

/* ══════════════════════════════════════════════
   Start Battle (transition from intro to first turn)
   ══════════════════════════════════════════════ */

export function startBattle(state: BattleState): BattleState {
  return {
    ...state,
    phase: state.turnOrder[0]
      ? (state.combatants.find((c) => c.id === state.turnOrder[0])?.team === 'player'
        ? 'player-turn'
        : 'enemy-turn')
      : 'player-turn',
    updatedAt: new Date().toISOString(),
  }
}
