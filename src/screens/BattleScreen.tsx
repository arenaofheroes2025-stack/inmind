/**
 * BattleScreen — Tactical turn-based combat screen.
 *
 * Visual layout:
 * ┌─────────────────────────────────────────────────┐
 * │  Turn Order Strip (portraits in initiative order)│
 * ├───────────────┬─────────────────────────────────┤
 * │  Player HUD   │    6x6 3D Arena (Three.js)      │
 * │  (party stats)│   square tiles + 2D sprites      │
 * ├───────────────┼─────────────────────────────────┤
 * │  Action Panel │         Battle Log               │
 * │  (buttons)    │       (scrollable entries)        │
 * └───────────────┴─────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Crosshair,
  Crown,
  Dice5,
  Flame,
  Footprints,
  Heart,
  Shield,
  ShieldAlert,
  Skull,
  Sparkles,
  Star,
  Sword,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react'
import type {
  BattleAction,
  BattleCombatant,
  BattleSkill,
  BattleState,
  GridPosition,
} from '../data/types'
import {
  advanceTurn,
  executeAction,
  getAttackRange,
  getEffectiveAttributes,
  getMovementRange,
  getCurrentCombatant,
  manhattan,
  performDiceRoll,
  applyDiceRollToAction,
  startBattle,
  type DiceRollResult,
} from '../systems/battleEngine'
import {
  narrateLogEntry,
  narrateBattleIntro,
  narrateBattleConclusion,
  narrateDiceRollMoment,
  extractBattleHighlights,
} from '../services/agents/battleNarrator'
import { useGameStore } from '../store/useGameStore'
import { useNavigateGame } from '../app/routes'
import { getBattle, saveBattle, getWorld, getLocation } from '../services/cache'
import { HPBar } from '../components/HPBar'
import { NarrationButton } from '../components/NarrationButton'
import { BattleArena3D, type AttackEvent } from '../components/BattleArena3D'

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */

/* Tile color classes used only for the side panel, not the 3D arena */

/* ══════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════ */

export function BattleScreen() {
  const currentWorldId = useGameStore((s) => s.currentWorldId)
  const currentBattleId = useGameStore((s) => s.currentBattleId)
  const { goPlay } = useNavigateGame()

  const [battle, setBattle] = useState<BattleState | null>(null)
  const [loading, setLoading] = useState(true)
  const [introText, setIntroText] = useState<string>('')
  const [conclusionText, setConclusionText] = useState<string>('')
  const [showIntro, setShowIntro] = useState(true)
  const [showConclusion, setShowConclusion] = useState(false)
  const [locationImageUrl, setLocationImageUrl] = useState<string | undefined>(undefined)

  // Action mode
  const [actionMode, setActionMode] = useState<'idle' | 'move' | 'attack' | 'skill'>('idle')
  const [selectedSkill, setSelectedSkill] = useState<BattleSkill | null>(null)
  const [highlightedTiles, setHighlightedTiles] = useState<GridPosition[]>([])
  const [showSkillDrawer, setShowSkillDrawer] = useState(false)

  // Dice roll — toggle mode (activate before choosing action)
  const [diceActive, setDiceActive] = useState(false)
  const [showDiceRoll, setShowDiceRoll] = useState(false)
  const [diceResult, setDiceResult] = useState<DiceRollResult | null>(null)
  const [dicePurpose, setDicePurpose] = useState<'attack' | 'defense' | 'skill' | 'move'>('attack')
  const [diceNarration, setDiceNarration] = useState<string | null>(null)
  /** Pending action to execute AFTER dice animation completes */
  const pendingDiceAction = useRef<{
    type: 'move' | 'attack' | 'skill' | 'defend'
    pos?: GridPosition
    targetId?: string
    skillId?: string
  } | null>(null)

  // Floating damage numbers
  const [floatingNumbers, setFloatingNumbers] = useState<
    { id: string; pos: GridPosition; value: number; type: 'damage' | 'heal' }[]
  >([])

  // Attack cinematic event
  const [attackEvent, setAttackEvent] = useState<AttackEvent | null>(null)

  const logRef = useRef<HTMLDivElement>(null)

  /* ── Load / Init ── */
  useEffect(() => {
    if (!currentBattleId) {
      setLoading(false)
      return
    }
    let cancelled = false

    ;(async () => {
      const existingBattle = await getBattle(currentBattleId)
      if (cancelled) return

      if (existingBattle) {
        // Load location image
        if (existingBattle.locationId) {
          try {
            const loc = await getLocation(existingBattle.locationId)
            if (loc?.imageUrl) setLocationImageUrl(loc.imageUrl)
          } catch { /* ignore */ }
        }

        if (existingBattle.phase === 'intro') {
          await initBattle(existingBattle)
        } else {
          setBattle(existingBattle)
          setShowIntro(false)
        }
      }
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [currentBattleId])

  /* ── Init battle from store data ── */
  const initBattle = useCallback(async (state: BattleState) => {
    setBattle(state)
    setLoading(false)

    // Generate intro narration via AI
    if (currentWorldId) {
      try {
        const world = await getWorld(currentWorldId)
        let location = null
        if (state.locationId) location = await getLocation(state.locationId)

        if (world) {
          const intro = await narrateBattleIntro({
            world,
            location: location ?? { id: 'unknown', name: 'Campo de Batalha', type: 'combate', dangerLevel: 5, storyRelevance: 'main', linkedActs: [] },
            playerNames: state.combatants.filter((c) => c.team === 'player').map((c) => c.name),
            enemyNames: state.combatants.filter((c) => c.team === 'enemy').map((c) => c.name),
          })
          setIntroText(intro)
        }
      } catch {
        setIntroText('O combate começa!')
      }
    }
  }, [currentWorldId])

  /* ── Persist battle state ── */
  useEffect(() => {
    if (battle) {
      saveBattle(battle).catch(() => {})
    }
  }, [battle])

  /* ── Auto-scroll battle log ── */
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [battle?.actionLog.length])

  /* ── Derived state ── */
  const currentCombatant = useMemo(() => battle ? getCurrentCombatant(battle) : null, [battle])
  const isPlayerTurn = battle?.phase === 'player-turn'
  const isEnemyTurn = battle?.phase === 'enemy-turn'
  const isBattleOver = battle?.phase === 'victory' || battle?.phase === 'defeat'

  const players = useMemo(() => battle?.combatants.filter((c) => c.team === 'player') ?? [], [battle])
  const enemies = useMemo(() => battle?.combatants.filter((c) => c.team === 'enemy') ?? [], [battle])

  /* ── Handle conclusion ── */
  useEffect(() => {
    if (!battle || !isBattleOver || showConclusion) return

    ;(async () => {
      try {
        const world = currentWorldId ? await getWorld(currentWorldId) : null
        let location = null
        if (battle.locationId) location = await getLocation(battle.locationId)

        const highlights = extractBattleHighlights(battle)
        const text = await narrateBattleConclusion(
          {
            world: world ?? { id: '', title: 'Mundo', genre: 'fantasia', tone: 'epico', synopsis: '', acts: [], locations: [], finalObjective: '', createdAt: '' },
            location: location ?? { id: 'unknown', name: 'Campo de Batalha', type: 'combate', dangerLevel: 5, storyRelevance: 'main', linkedActs: [] },
            playerNames: players.map((c) => c.name),
            enemyNames: enemies.map((c) => c.name),
          },
          battle.phase === 'victory',
          highlights,
        )
        setConclusionText(text)
      } catch {
        setConclusionText(
          battle.phase === 'victory' ? 'Vitória! Os heróis triunfam!' : 'Derrota... Mas a história continua.',
        )
      }
      setShowConclusion(true)
    })()
  }, [isBattleOver, battle, showConclusion, currentWorldId, players, enemies])

  /* ── Enemy AI auto-play ── */
  // Enemy action queue — actions are applied one at a time with delays
  const [enemyActionQueue, setEnemyActionQueue] = useState<BattleAction[]>([])
  const [isEnemyAnimating, setIsEnemyAnimating] = useState(false)

  /* ── Enemy AI: build action queue ── */
  useEffect(() => {
    if (!battle || !isEnemyTurn || !currentCombatant || isEnemyAnimating || enemyActionQueue.length > 0) return

    // Wait for camera zoom-in to finish before starting enemy actions
    const timer = setTimeout(() => {
      import('../systems/battleEngine').then(({ getEnemyAction }) => {
        const actions = getEnemyAction(battle, currentCombatant.id)
        if (actions.length > 0) {
          setEnemyActionQueue(actions)
          setIsEnemyAnimating(true)
        } else {
          // No actions — just advance turn
          const next = advanceTurn(battle)
          setBattle(next)
        }
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [isEnemyTurn, battle, currentCombatant, isEnemyAnimating, enemyActionQueue.length])

  /* ── Enemy AI: execute one action at a time from queue ── */
  useEffect(() => {
    if (!battle || !isEnemyAnimating || enemyActionQueue.length === 0) return

    const [nextAction, ...remaining] = enemyActionQueue
    // Delay between each enemy action so camera can follow and movement/attack is visible
    const delay = nextAction.type === 'move' ? 1200 : 1300

    const timer = setTimeout(() => {
      // Trigger attack cinematic for enemy attacks/skills
      if ((nextAction.type === 'attack' || nextAction.type === 'skill') && nextAction.targetId) {
        setAttackEvent({ attackerId: nextAction.actorId, targetId: nextAction.targetId, ts: Date.now() })
      }

      let state = executeAction(battle, nextAction)

      // Show floating number for attack/skill
      if ((nextAction.type === 'attack' || nextAction.type === 'skill') && nextAction.targetId) {
        const target = state.combatants.find((c) => c.id === nextAction.targetId)
        if (target) addFloatingNumber(target.position, state)
      }

      if (state.phase === 'victory' || state.phase === 'defeat') {
        setBattle(state)
        setEnemyActionQueue([])
        setIsEnemyAnimating(false)
        return
      }

      if (remaining.length > 0) {
        setBattle(state)
        setEnemyActionQueue(remaining)
      } else {
        // All actions done — wait for camera to settle before advancing turn
        setBattle(state)
        setTimeout(() => {
          setBattle((prev) => {
            if (!prev) return prev
            const next = advanceTurn(prev)
            return next
          })
          setEnemyActionQueue([])
          setIsEnemyAnimating(false)
        }, 1000)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [battle, isEnemyAnimating, enemyActionQueue])

  /* ── Action handlers ── */

  /** Toggle dice active mode */
  const handleToggleDice = useCallback(() => {
    if (!currentCombatant || currentCombatant.diceRollsRemaining <= 0) return
    setDiceActive((prev) => !prev)
  }, [currentCombatant])

  /**
  /** Execute the pending action with dice bonuses applied */
  const executePendingDiceAction = useCallback(
    (result: DiceRollResult) => {
      const pending = pendingDiceAction.current
      if (!pending) return
      pendingDiceAction.current = null
      setShowDiceRoll(false)

      setBattle((prevBattle) => {
        if (!prevBattle) return prevBattle
        const actor = getCurrentCombatant(prevBattle)
        if (!actor) return prevBattle

        if (pending.type === 'move' && pending.pos) {
          // Dice success = move up to 5 tiles; failure = normal AP
          const moveRange = result.success ? 5 : actor.actionPoints
          const reachable = getMovementRange(prevBattle, actor.position, moveRange)
          if (!reachable.some((p) => p.col === pending.pos!.col && p.row === pending.pos!.row)) return prevBattle

          const action: BattleAction = { type: 'move', actorId: actor.id, targetPosition: pending.pos }
          const newState = executeAction(prevBattle, action)
          // Update highlighted tiles after move
          const updated = newState.combatants.find((c) => c.id === actor.id)
          if (updated && updated.actionPoints > 0) {
            const remaining = getMovementRange(newState, updated.position, updated.actionPoints)
            setHighlightedTiles(remaining)
          } else {
            setActionMode('idle')
            setHighlightedTiles([])
          }
          return newState
        }

        if (pending.type === 'attack' && pending.targetId) {
          const action: BattleAction = { type: 'attack', actorId: actor.id, targetId: pending.targetId }
          setAttackEvent({ attackerId: actor.id, targetId: pending.targetId, ts: Date.now() })
          let newState = executeAction(prevBattle, action)
          // Apply dice bonus: success = +50% damage, crit = +100%
          if (result.success) {
            const lastIdx = newState.actionLog.length - 1
            newState = applyDiceRollToAction(newState, actor.id, result, lastIdx)
          }
          const target = newState.combatants.find((c) => c.id === pending.targetId)
          if (target) addFloatingNumber(target.position, newState)
          setActionMode('idle')
          setHighlightedTiles([])
          return newState
        }

        if (pending.type === 'skill' && pending.targetId && pending.skillId) {
          const action: BattleAction = { type: 'skill', actorId: actor.id, targetId: pending.targetId, skillId: pending.skillId }
          setAttackEvent({ attackerId: actor.id, targetId: pending.targetId, ts: Date.now() })
          let newState = executeAction(prevBattle, action)
          if (result.success) {
            const lastIdx = newState.actionLog.length - 1
            newState = applyDiceRollToAction(newState, actor.id, result, lastIdx)
          }
          const target = newState.combatants.find((c) => c.id === pending.targetId)
          if (target) addFloatingNumber(target.position, newState)
          setActionMode('idle')
          setHighlightedTiles([])
          setSelectedSkill(null)
          return newState
        }

        if (pending.type === 'defend') {
          const action: BattleAction = { type: 'defend', actorId: actor.id }
          let newState = executeAction(prevBattle, action)
          // Dice success = defense doubles (apply bonus)
          if (result.success) {
            const lastIdx = newState.actionLog.length - 1
            newState = applyDiceRollToAction(newState, actor.id, result, lastIdx)
          }
          setActionMode('idle')
          setHighlightedTiles([])
          return newState
        }

        return prevBattle
      })

      // Request AI narration in background
      ;(async () => {
        try {
          const world = currentWorldId ? await getWorld(currentWorldId) : null
          const location = battle ? await getLocation(battle.locationId ?? '') : null
          if (world && location) {
            const purposeLabel = pending.type === 'move' ? 'mover-se com agilidade'
              : pending.type === 'attack' ? 'atacar com força'
              : pending.type === 'skill' ? 'usar uma habilidade poderosa'
              : 'defender-se bravamente'
            const narration = await narrateDiceRollMoment(
              { world, location, playerNames: players.map((c) => c.name), enemyNames: enemies.map((c) => c.name) },
              getCurrentCombatant(battle!)?.name ?? 'Herói',
              result.roll,
              result.isCrit,
              result.isCritFail,
              purposeLabel,
            )
            setDiceNarration(narration)
          }
        } catch {
          // Narration is optional
        }
      })()
    },
    [battle, currentWorldId, players, enemies],
  )

  /**
   * Trigger dice roll animation then execute boosted action.
   * Returns true if dice was consumed (caller should NOT execute action).
   */
  const triggerDiceRoll = useCallback(
    (
      purpose: 'attack' | 'defense' | 'skill' | 'move',
      pendingAction: { type: 'move' | 'attack' | 'skill' | 'defend'; pos?: GridPosition; targetId?: string; skillId?: string },
    ) => {
      if (!battle || !currentCombatant) return
      pendingDiceAction.current = pendingAction
      setDicePurpose(purpose)
      setDiceNarration(null)
      // Perform the roll
      const result = performDiceRoll(currentCombatant, purpose)
      setDiceResult(result)
      setShowDiceRoll(true)
      setDiceActive(false)

      // Consume dice roll
      const next = { ...battle, combatants: battle.combatants.map((c) => ({ ...c })) }
      const actor = next.combatants.find((c) => c.id === currentCombatant.id)
      if (actor) actor.diceRollsRemaining = Math.max(0, actor.diceRollsRemaining - 1)
      next.updatedAt = new Date().toISOString()
      setBattle(next)

      // After 4 seconds, execute the boosted action
      setTimeout(() => {
        executePendingDiceAction(result)
      }, 4000)
    },
    [battle, currentCombatant, executePendingDiceAction],
  )

  const handleSetMode = useCallback(
    (mode: 'move' | 'attack' | 'skill') => {
      if (!battle || !currentCombatant || !isPlayerTurn) return

      if (mode === actionMode) {
        setActionMode('idle')
        setHighlightedTiles([])
        setSelectedSkill(null)
        return
      }

      setActionMode(mode)
      if (mode === 'move') {
        // If dice is active, show extended range (5 tiles)
        const moveRange = diceActive ? 5 : currentCombatant.actionPoints
        const reachable = getMovementRange(battle, currentCombatant.position, moveRange)
        setHighlightedTiles(reachable)
      } else if (mode === 'attack') {
        const range = getAttackRange(battle, currentCombatant.position, 1)
        setHighlightedTiles(range)
      }
    },
    [battle, currentCombatant, isPlayerTurn, actionMode, diceActive],
  )

  const handleSkillSelect = useCallback(
    (skill: BattleSkill) => {
      if (!battle || !currentCombatant) return
      setSelectedSkill(skill)
      setActionMode('skill')
      setShowSkillDrawer(false)
      const range = getAttackRange(battle, currentCombatant.position, skill.range)
      setHighlightedTiles(range)
    },
    [battle, currentCombatant],
  )

  const handleTileClick = useCallback(
    (pos: GridPosition) => {
      if (!battle || !currentCombatant || !isPlayerTurn || showDiceRoll) return

      if (actionMode === 'move') {
        const moveRange = diceActive ? 5 : currentCombatant.actionPoints
        const reachable = getMovementRange(battle, currentCombatant.position, moveRange)
        if (!reachable.some((p) => p.col === pos.col && p.row === pos.row)) return

        // If dice is active, trigger dice roll first
        if (diceActive) {
          triggerDiceRoll('move', { type: 'move', pos })
          return
        }

        const action: BattleAction = {
          type: 'move',
          actorId: currentCombatant.id,
          targetPosition: pos,
        }
        const newState = executeAction(battle, action)
        setBattle(newState)

        const updatedCombatant = newState.combatants.find((c) => c.id === currentCombatant.id)
        if (updatedCombatant && updatedCombatant.actionPoints > 0) {
          const remaining = getMovementRange(newState, updatedCombatant.position, updatedCombatant.actionPoints)
          setHighlightedTiles(remaining)
        } else {
          setActionMode('idle')
          setHighlightedTiles([])
        }
        return
      }

      // Attack or skill: find combatant on target tile
      const target = battle.combatants.find(
        (c) => c.hp > 0 && c.position.col === pos.col && c.position.row === pos.row && c.id !== currentCombatant.id,
      )
      if (!target) return

      if (actionMode === 'attack') {
        if (manhattan(currentCombatant.position, target.position) > 1) return

        if (diceActive) {
          triggerDiceRoll('attack', { type: 'attack', targetId: target.id })
          return
        }

        const action: BattleAction = {
          type: 'attack',
          actorId: currentCombatant.id,
          targetId: target.id,
        }
        setAttackEvent({ attackerId: currentCombatant.id, targetId: target.id, ts: Date.now() })
        const newState = executeAction(battle, action)
        addFloatingNumber(target.position, newState)
        setBattle(newState)
        setActionMode('idle')
        setHighlightedTiles([])
      } else if (actionMode === 'skill' && selectedSkill) {
        if (manhattan(currentCombatant.position, target.position) > selectedSkill.range) return

        if (diceActive) {
          triggerDiceRoll('skill', { type: 'skill', targetId: target.id, skillId: selectedSkill.id })
          return
        }

        const action: BattleAction = {
          type: 'skill',
          actorId: currentCombatant.id,
          targetId: target.id,
          skillId: selectedSkill.id,
        }
        setAttackEvent({ attackerId: currentCombatant.id, targetId: target.id, ts: Date.now() })
        const newState = executeAction(battle, action)
        addFloatingNumber(target.position, newState)
        setBattle(newState)
        setActionMode('idle')
        setHighlightedTiles([])
        setSelectedSkill(null)
      }
    },
    [battle, currentCombatant, isPlayerTurn, actionMode, selectedSkill, diceActive, showDiceRoll, triggerDiceRoll],
  )

  const handleDefend = useCallback(() => {
    if (!battle || !currentCombatant || showDiceRoll) return

    if (diceActive) {
      triggerDiceRoll('defense', { type: 'defend' })
      return
    }

    const action: BattleAction = { type: 'defend', actorId: currentCombatant.id }
    const newState = executeAction(battle, action)
    setBattle(newState)
    setActionMode('idle')
    setHighlightedTiles([])
  }, [battle, currentCombatant, diceActive, showDiceRoll, triggerDiceRoll])

  const handleEndTurn = useCallback(() => {
    if (!battle || !currentCombatant) return
    const action: BattleAction = { type: 'end-turn', actorId: currentCombatant.id }
    let newState = executeAction(battle, action)
    newState = advanceTurn(newState)
    setBattle(newState)
    setActionMode('idle')
    setHighlightedTiles([])
    setDiceActive(false)
  }, [battle, currentCombatant])

  const handleReturnToAdventure = useCallback(() => {
    if (currentWorldId) goPlay(currentWorldId)
  }, [currentWorldId, goPlay])

  /* ── Floating damage numbers ── */
  const addFloatingNumber = (pos: GridPosition, newState: BattleState) => {
    const lastLog = newState.actionLog[newState.actionLog.length - 1]
    if (!lastLog) return
    if (lastLog.damage || lastLog.healing) {
      const id = crypto.randomUUID()
      setFloatingNumbers((prev) => [
        ...prev,
        {
          id,
          pos,
          value: lastLog.damage ?? lastLog.healing ?? 0,
          type: lastLog.damage ? 'damage' : 'heal',
        },
      ])
      setTimeout(() => {
        setFloatingNumbers((prev) => prev.filter((n) => n.id !== id))
      }, 1800)
    }
  }

  /* ── Start battle from intro ── */
  const handleStartBattle = useCallback(() => {
    if (!battle) return
    const started = startBattle(battle)
    setBattle(started)
    setShowIntro(false)
  }, [battle])

  /* ══════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Swords className="mx-auto h-12 w-12 animate-pulse text-gold" />
          <p className="mt-4 font-display text-lg text-gold">Preparando batalha...</p>
        </div>
      </div>
    )
  }

  if (!battle) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-crimson" />
          <p className="mt-4 font-display text-lg text-crimson">Nenhuma batalha encontrada</p>
          <button
            onClick={handleReturnToAdventure}
            className="mt-4 rounded-lg border border-gold/30 bg-panel px-6 py-2 font-display text-sm text-gold transition hover:bg-gold/10"
          >
            Voltar à Aventura
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── INTRO OVERLAY ── */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="battle-intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative mx-4 max-w-lg overflow-hidden border border-crimson/30 bg-panel shadow-2xl"
              style={{ clipPath: 'polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px))' }}
            >
              {/* accents */}
              <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-crimson/60 to-transparent" />
              <div className="absolute right-0 top-0 z-20">
                <svg width="30" height="30" className="text-crimson/50"><line x1="2" y1="0" x2="30" y2="28" stroke="currentColor" strokeWidth="1" /></svg>
              </div>
              <div className="absolute bottom-0 left-0 z-20">
                <svg width="30" height="30" className="text-crimson/50"><line x1="0" y1="2" x2="28" y2="30" stroke="currentColor" strokeWidth="1" /></svg>
              </div>

              <div className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-crimson/10"
                    style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}
                  >
                    <Swords className="h-5 w-5 text-crimson" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-crimson">Batalha!</h2>
                </div>
                <p className="whitespace-pre-line font-body text-sm leading-relaxed text-ink">
                  {introText || 'O combate está prestes a começar...'}
                </p>

                {/* Combatant preview */}
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5">
                    {players.map((p) => (
                      <div key={p.id} className="flex items-center gap-1 rounded-sm border border-glow/20 bg-glow/5 px-2 py-1 text-[10px] font-bold text-glow">
                        <Sword className="h-2.5 w-2.5" />
                        <span>{p.name}</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-gold-dim">VS</span>
                  <div className="flex flex-wrap gap-1.5">
                    {enemies.filter((e) => e.hp > 0).map((e) => (
                      <div key={e.id} className="flex items-center gap-1 rounded-sm border border-crimson/20 bg-crimson/5 px-2 py-1 text-[10px] font-bold text-crimson">
                        <Skull className="h-2.5 w-2.5" />
                        <span>{e.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {introText && (
                  <div className="mt-3 flex justify-center">
                    <NarrationButton text={introText} size="sm" />
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartBattle}
                  className="mt-4 w-full border border-crimson/40 bg-crimson/10 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-crimson transition hover:bg-crimson/20 hover:shadow-[0_0_20px_rgba(220,38,38,0.15)]"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}
                >
                  Iniciar Combate ⚔️
                </motion.button>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-crimson/20 to-transparent" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONCLUSION OVERLAY ── */}
      <AnimatePresence>
        {showConclusion && (
          <motion.div
            key="battle-conclusion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 backdrop-blur-sm"
          >
            {(() => {
              const isVictory = battle.phase === 'victory'
              const accentColor = isVictory ? 'gold' : 'crimson'
              return (
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className={`relative mx-4 max-w-lg overflow-hidden border bg-panel shadow-2xl ${
                    isVictory ? 'border-gold/40' : 'border-crimson/40'
                  }`}
                  style={{ clipPath: 'polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px))' }}
                >
                  {/* accents */}
                  <div className={`absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-${accentColor}/60 to-transparent`} />
                  <div className="absolute right-0 top-0 z-20">
                    <svg width="30" height="30" className={`text-${accentColor}/50`}><line x1="2" y1="0" x2="30" y2="28" stroke="currentColor" strokeWidth="1" /></svg>
                  </div>
                  <div className="absolute bottom-0 left-0 z-20">
                    <svg width="30" height="30" className={`text-${accentColor}/50`}><line x1="0" y1="2" x2="28" y2="30" stroke="currentColor" strokeWidth="1" /></svg>
                  </div>

                  <div className="p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded ${
                        isVictory ? 'bg-gold/10' : 'bg-crimson/10'
                      }`}
                        style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                      >
                        {isVictory ? (
                          <Trophy className="h-6 w-6 text-gold" />
                        ) : (
                          <Skull className="h-6 w-6 text-crimson" />
                        )}
                      </div>
                      <div>
                        <h2 className={`font-display text-2xl font-bold ${isVictory ? 'text-gold' : 'text-crimson'}`}>
                          {isVictory ? 'Vitória!' : 'Derrota'}
                        </h2>
                        <p className="text-[10px] uppercase tracking-wider text-ink-muted">
                          {isVictory ? 'Os heróis triunfaram!' : 'A escuridão venceu...'}
                        </p>
                      </div>
                    </div>
                    <p className="whitespace-pre-line font-body text-sm leading-relaxed text-ink">
                      {conclusionText}
                    </p>
                    {battle.rewards && (
                      <div
                        className="mt-4 overflow-hidden border border-gold/20 bg-obsidian/40"
                        style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))' }}
                      >
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                        <div className="p-3">
                          <h3 className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-gold">
                            <Star className="h-3 w-3" /> Recompensas
                          </h3>
                          <div className="flex gap-4 text-sm font-bold">
                            <span className="flex items-center gap-1 text-gold">
                              <Star className="h-3.5 w-3.5" /> {battle.rewards.xp} XP
                            </span>
                            <span className="flex items-center gap-1 text-amber-400">
                              💰 {battle.rewards.gold} ouro
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {conclusionText && (
                      <div className="mt-3 flex justify-center">
                        <NarrationButton text={conclusionText} size="sm" />
                      </div>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleReturnToAdventure}
                      className={`mt-4 w-full border px-4 py-3 font-display text-sm font-bold uppercase tracking-wider transition ${
                        isVictory
                          ? 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 hover:shadow-[0_0_20px_rgba(201,168,76,0.15)]'
                          : 'border-crimson/40 bg-crimson/10 text-crimson hover:bg-crimson/20'
                      }`}
                      style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}
                    >
                      Voltar à Aventura
                    </motion.button>
                  </div>
                  <div className={`absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-${accentColor}/20 to-transparent`} />
                </motion.div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DICE ROLL OVERLAY (animated rolling) ── */}
      <AnimatePresence>
        {showDiceRoll && diceResult && (
          <DiceRollOverlay
            result={diceResult}
            purpose={dicePurpose}
            narration={diceNarration}
          />
        )}
      </AnimatePresence>

      {/* ── TURN ORDER STRIP ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-gold/20 bg-panel/80 backdrop-blur-sm"
        style={{ clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))' }}
      >
        {/* corner accents */}
        <div className="absolute right-0 top-0 z-20">
          <svg width="22" height="22" className="text-gold/40"><line x1="2" y1="0" x2="22" y2="20" stroke="currentColor" strokeWidth="1" /></svg>
        </div>
        <div className="absolute bottom-0 left-0 z-20">
          <svg width="22" height="22" className="text-gold/40"><line x1="0" y1="2" x2="20" y2="22" stroke="currentColor" strokeWidth="1" /></svg>
        </div>
        {/* top accent line */}
        <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        <div className="px-3 py-2">
          <div className="mb-1.5 flex items-center justify-center gap-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-gold/20" />
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-gold">
              <Swords className="h-3 w-3" />
              Round {battle.round}
            </span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-gold/20" />
          </div>
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-0.5">
            {battle.turnOrder.map((id, i) => {
              const c = battle.combatants.find((cb) => cb.id === id)
              if (!c || c.hp <= 0) return null
              const isCurrent = i === battle.currentTurnIndex
              return (
                <motion.div
                  key={id}
                  animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                  transition={isCurrent ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
                  className={`group relative flex flex-col items-center transition-all duration-300 ${
                    isCurrent ? 'z-10' : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {/* Active glow ring */}
                  {isCurrent && (
                    <div className={`absolute -inset-0.5 rounded-xl ${
                      c.team === 'player' ? 'bg-glow/20' : 'bg-crimson/20'
                    } blur-sm`} />
                  )}
                  <div
                    className={`relative flex flex-col items-center rounded-lg border px-2.5 py-1.5 transition-all ${
                      isCurrent
                        ? c.team === 'player'
                          ? 'border-glow/50 bg-glow/10 shadow-[0_0_12px_rgba(78,203,113,0.15)]'
                          : 'border-crimson/50 bg-crimson/10 shadow-[0_0_12px_rgba(220,38,38,0.15)]'
                        : 'border-gold/10 bg-surface/30'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold ${
                        c.team === 'player'
                          ? 'border-glow/30 bg-glow/15 text-glow'
                          : 'border-crimson/30 bg-crimson/15 text-crimson'
                      }`}
                    >
                      {c.portraitUrl ? (
                        <img src={c.portraitUrl} alt={c.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        c.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className={`mt-1 max-w-[48px] truncate text-[8px] font-bold ${
                      c.team === 'player' ? 'text-glow' : 'text-crimson'
                    }`}>
                      {c.name}
                    </span>
                    {isCurrent && (
                      <motion.div
                        className={`absolute -bottom-1 h-[2px] w-6 rounded-full ${
                          c.team === 'player' ? 'bg-glow' : 'bg-crimson'
                        }`}
                        layoutId="turn-indicator"
                      />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
        {/* bottom accent line */}
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
      </motion.div>

      {/* ── MAIN LAYOUT ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">

        {/* ── LEFT PANEL: Party + Enemies ── */}
        <div className="flex flex-col gap-3">
          {/* Player combatants */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden border border-glow/20 bg-panel/70 backdrop-blur-sm"
            style={{ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}
          >
            {/* accent bar */}
            <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-glow/40 to-transparent" />
            {/* corner accents */}
            <div className="absolute right-0 top-0 z-20">
              <svg width="18" height="18" className="text-glow/40"><line x1="2" y1="0" x2="18" y2="16" stroke="currentColor" strokeWidth="1" /></svg>
            </div>
            <div className="p-3">
              <div className="mb-2.5 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-glow/10"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
                >
                  <Crown className="h-3 w-3 text-glow" />
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-glow">Grupo</h3>
                <div className="ml-auto flex items-center gap-1 rounded-sm bg-glow/8 px-1.5 py-0.5 text-[8px] font-bold text-glow">
                  <Heart className="h-2.5 w-2.5" />
                  {players.filter(p => p.hp > 0).length}/{players.length}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {players.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                    <CombatantCard combatant={p} isCurrent={currentCombatant?.id === p.id} team="player" />
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-glow/10 to-transparent" />
          </motion.div>

          {/* Enemy combatants */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden border border-crimson/20 bg-panel/70 backdrop-blur-sm"
            style={{ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}
          >
            {/* accent bar */}
            <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-crimson/40 to-transparent" />
            <div className="absolute right-0 top-0 z-20">
              <svg width="18" height="18" className="text-crimson/40"><line x1="2" y1="0" x2="18" y2="16" stroke="currentColor" strokeWidth="1" /></svg>
            </div>
            <div className="p-3">
              <div className="mb-2.5 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-crimson/10"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
                >
                  <Skull className="h-3 w-3 text-crimson" />
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-crimson">Inimigos</h3>
                <div className="ml-auto flex items-center gap-1 rounded-sm bg-crimson/8 px-1.5 py-0.5 text-[8px] font-bold text-crimson">
                  <Crosshair className="h-2.5 w-2.5" />
                  {enemies.filter(e => e.hp > 0).length}/{enemies.length}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {enemies.map((e, i) => (
                  <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.05 }}>
                    <CombatantCard combatant={e} isCurrent={currentCombatant?.id === e.id} team="enemy" />
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-crimson/10 to-transparent" />
          </motion.div>
        </div>

        {/* ── RIGHT PANEL: Grid + Actions + Log ── */}
        <div className="flex flex-col gap-3">
          {/* ── 3D Arena (Three.js) — action panel overlaid inside ── */}
          <div className="relative">
            <BattleArena3D
              battle={battle}
              highlightedTiles={highlightedTiles}
              actionMode={actionMode}
              currentCombatantId={currentCombatant?.id ?? null}
              onTileClick={handleTileClick}
              floatingNumbers={floatingNumbers}
              locationImageUrl={locationImageUrl}
              attackEvent={attackEvent}
            />

            {/* ── ACTION PANEL (inside arena, bottom overlay) ── */}
            {isPlayerTurn && currentCombatant && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute inset-x-0 bottom-0 z-20 px-2 pb-2"
              >
                <div
                  className="relative overflow-hidden border border-gold/25 bg-obsidian/80 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] backdrop-blur-lg"
                  style={{ clipPath: 'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%, 0 12px)' }}
                >
                  {/* top accent */}
                  <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                  {/* corner accents */}
                  <div className="absolute left-0 top-0 z-20">
                    <svg width="14" height="14" className="text-gold/50"><line x1="0" y1="2" x2="12" y2="14" stroke="currentColor" strokeWidth="1" /></svg>
                  </div>
                  <div className="absolute right-0 top-0 z-20">
                    <svg width="14" height="14" className="text-gold/50"><line x1="2" y1="0" x2="14" y2="12" stroke="currentColor" strokeWidth="1" /></svg>
                  </div>

                  <div className="px-3 py-2">
                    {/* Header with character info */}
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-glow/30 bg-glow/10">
                          {currentCombatant.portraitUrl ? (
                            <img src={currentCombatant.portraitUrl} alt="" className="h-full w-full rounded-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-bold text-glow">{currentCombatant.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gold">{currentCombatant.name}</span>
                          <div className="flex items-center gap-2">
                            {/* AP pips */}
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: currentCombatant.maxActionPoints }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`h-1.5 w-3 rounded-sm transition-colors ${
                                    i < currentCombatant.actionPoints
                                      ? 'bg-gold shadow-[0_0_4px_rgba(201,168,76,0.4)]'
                                      : 'bg-ink-muted/20'
                                  }`}
                                />
                              ))}
                              <span className="ml-1 text-[8px] font-bold text-gold-dim">AP</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {currentCombatant.diceRollsRemaining > 0 && (
                        <div className="flex items-center gap-1 rounded-sm border border-gold/20 bg-gold/5 px-1.5 py-0.5">
                          <Dice5 className="h-3 w-3 text-gold" />
                          <span className="text-[9px] font-bold text-gold">{currentCombatant.diceRollsRemaining}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-1">
                      <ActionButton
                        icon={<Footprints className="h-3 w-3" />}
                        label="Mover"
                        active={actionMode === 'move'}
                        disabled={currentCombatant.actionPoints < 1 || currentCombatant.statusEffects.some((e) => e.id === 'enraizado')}
                        onClick={() => handleSetMode('move')}
                      />
                      <ActionButton
                        icon={<Sword className="h-3 w-3" />}
                        label="Atacar"
                        active={actionMode === 'attack'}
                        disabled={currentCombatant.actionPoints < 1 || currentCombatant.hasAttacked || currentCombatant.hasDefended}
                        onClick={() => handleSetMode('attack')}
                      />
                      <ActionButton
                        icon={<Sparkles className="h-3 w-3" />}
                        label="Habilidade"
                        active={showSkillDrawer}
                        disabled={currentCombatant.actionPoints < 1 || currentCombatant.hasAttacked || currentCombatant.hasDefended || currentCombatant.skills.every((s) => s.currentUses <= 0)}
                        onClick={() => setShowSkillDrawer(!showSkillDrawer)}
                      />
                      <ActionButton
                        icon={<Shield className="h-3 w-3" />}
                        label="Defender"
                        disabled={currentCombatant.actionPoints < 1 || currentCombatant.hasAttacked || currentCombatant.hasDefended}
                        onClick={handleDefend}
                      />
                      {currentCombatant.diceRollsRemaining > 0 && (
                        <ActionButton
                          icon={<Dice5 className="h-3 w-3" />}
                          label={`d20 (${currentCombatant.diceRollsRemaining})`}
                          active={diceActive}
                          onClick={handleToggleDice}
                          variant={diceActive ? 'default' : 'default'}
                        />
                      )}
                      <ActionButton
                        icon={<ArrowRight className="h-3 w-3" />}
                        label="Fim Turno"
                        onClick={handleEndTurn}
                        variant="end-turn"
                      />
                    </div>

                    {/* Skill Drawer */}
                    <AnimatePresence>
                      {showSkillDrawer && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-2 overflow-hidden"
                        >
                          <div className="mb-1.5 h-[1px] bg-gradient-to-r from-transparent via-arcane/30 to-transparent" />
                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                            {currentCombatant.skills.map((skill) => {
                              const isUsable = skill.currentUses > 0 && !currentCombatant.hasAttacked && !currentCombatant.hasDefended
                              const isSelected = selectedSkill?.id === skill.id
                              return (
                                <button
                                  key={skill.id}
                                  disabled={!isUsable}
                                  onClick={() => handleSkillSelect(skill)}
                                  className={`group relative overflow-hidden border p-2 text-left text-[10px] transition-all ${
                                    isUsable
                                      ? isSelected
                                        ? 'border-arcane/50 bg-arcane/15 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                                        : 'border-arcane/20 bg-arcane/5 hover:border-arcane/40 hover:bg-arcane/10'
                                      : 'border-ink-muted/10 bg-obsidian/30 text-ink-muted/40 cursor-not-allowed'
                                  }`}
                                  style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                                >
                                  {isUsable && <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-arcane/40 to-transparent" />}
                                  <div className={`font-bold ${isUsable ? 'text-ink' : ''}`}>{skill.name}</div>
                                  <div className="mt-0.5 text-[9px] leading-tight text-ink-muted line-clamp-2">{skill.description}</div>
                                  <div className="mt-1 flex items-center gap-2 text-[9px]">
                                    <span className="flex items-center gap-0.5 text-arcane">
                                      <Star className="h-2.5 w-2.5" />Lv{skill.level}
                                    </span>
                                    <span className="text-ink-muted">Alc: {skill.range}</span>
                                    <span className={`ml-auto font-bold ${skill.currentUses > 0 ? 'text-arcane' : 'text-crimson'}`}>
                                      {skill.currentUses}/{skill.maxUsesPerBattle}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── BATTLE LOG ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden border border-gold/15 bg-panel/50 backdrop-blur-sm"
            style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))' }}
          >
            <div className="absolute inset-x-0 top-0 z-10 h-[1px] bg-gradient-to-r from-transparent via-gold/25 to-transparent" />
            <div className="absolute right-0 top-0 z-20">
              <svg width="16" height="16" className="text-gold/30"><line x1="2" y1="0" x2="16" y2="14" stroke="currentColor" strokeWidth="1" /></svg>
            </div>
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-gold/8"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))' }}
                >
                  <Flame className="h-2.5 w-2.5 text-gold" />
                </div>
                <h3 className="text-[9px] font-bold uppercase tracking-[0.15em] text-gold-dim">
                  Registro de Batalha
                </h3>
                <div className="ml-auto text-[8px] text-ink-muted">{battle.actionLog.length} ações</div>
              </div>
              <div
                ref={logRef}
                className="max-h-40 space-y-0.5 overflow-y-auto pr-1 text-[11px]"
              >
              {battle.actionLog.length === 0 && (
                <p className="py-2 text-center text-[10px] italic text-ink-muted/40">A batalha ainda não começou...</p>
              )}
              {battle.actionLog.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-sm border-l-2 px-2 py-0.5 text-ink-muted ${
                    entry.isKill
                      ? 'border-l-crimson bg-crimson/5 text-crimson'
                      : entry.isCrit
                      ? 'border-l-gold bg-gold/5 text-gold'
                      : entry.actionType === 'dot'
                      ? 'border-l-ember text-ember'
                      : entry.actionType === 'hot'
                      ? 'border-l-glow text-glow'
                      : 'border-l-gold/10'
                  }`}
                >
                  <span className="mr-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-gold/8 text-[7px] font-bold text-gold-dim">
                    {entry.round}
                  </span>
                  {narrateLogEntry(entry)}
                </motion.div>
              ))}
            </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════ */

function CombatantCard({
  combatant,
  isCurrent,
  team,
}: {
  combatant: BattleCombatant
  isCurrent: boolean
  team: 'player' | 'enemy'
}) {
  const [expanded, setExpanded] = useState(false)
  const attrs = getEffectiveAttributes(combatant)
  const isDead = combatant.hp <= 0

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden border transition-all duration-300 ${
        isDead
          ? 'border-ink-muted/8 bg-obsidian/40 opacity-35'
          : isCurrent
          ? team === 'player'
            ? 'border-glow/40 bg-glow/8 shadow-[0_0_16px_rgba(78,203,113,0.1)]'
            : 'border-crimson/40 bg-crimson/8 shadow-[0_0_16px_rgba(220,38,38,0.1)]'
          : 'border-gold/10 bg-panel/40 hover:border-gold/20 hover:bg-panel/60'
      }`}
      style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* top accent line for current */}
      {isCurrent && (
        <div className={`absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent ${
          team === 'player' ? 'via-glow/60' : 'via-crimson/60'
        } to-transparent`} />
      )}
      {/* corner accent */}
      <div className="absolute right-0 top-0 z-20">
        <svg width="14" height="14" className={`transition-colors ${
          isCurrent ? (team === 'player' ? 'text-glow/50' : 'text-crimson/50') : 'text-gold/20 group-hover:text-gold/40'
        }`}>
          <line x1="2" y1="0" x2="14" y2="12" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>

      {/* Compact view: avatar + name + HP */}
      <div className="flex items-center gap-2.5 p-2.5">
        {/* Portrait */}
        <div className="relative">
          {isCurrent && !isDead && (
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`absolute -inset-1 rounded-full ${
                team === 'player' ? 'bg-glow/20' : 'bg-crimson/20'
              } blur-sm`}
            />
          )}
          <div
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
              isDead
                ? 'border-ink-muted/20 bg-obsidian/60 text-ink-muted grayscale'
                : team === 'player'
                ? 'border-glow/30 bg-glow/10 text-glow'
                : 'border-crimson/30 bg-crimson/10 text-crimson'
            }`}
          >
            {combatant.portraitUrl ? (
              <img src={combatant.portraitUrl} alt={combatant.name} className={`h-full w-full rounded-full object-cover ${isDead ? 'grayscale' : ''}`} />
            ) : (
              combatant.name.charAt(0)
            )}
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`truncate text-xs font-bold transition-colors ${
              isDead ? 'text-ink-muted line-through' : 'text-ink group-hover:text-gold'
            }`}>{combatant.name}</span>
            {combatant.isDefending && (
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Shield className="h-3 w-3 shrink-0 text-blue-400" />
              </motion.div>
            )}
            {isDead && <Skull className="h-3 w-3 shrink-0 text-crimson" />}
            {isCurrent && !isDead && (
              <span className={`ml-auto rounded-sm px-1 py-0.5 text-[7px] font-bold uppercase ${
                team === 'player' ? 'bg-glow/15 text-glow' : 'bg-crimson/15 text-crimson'
              }`}>
                Turno
              </span>
            )}
          </div>
          <div className="mt-1">
            <HPBar
              value={combatant.hp}
              max={combatant.maxHp}
              color={team === 'player' ? 'glow' : 'crimson'}
              size="sm"
            />
          </div>
        </div>
        <span className="text-[9px] text-ink-muted/40 transition-transform group-hover:translate-y-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded details (click to toggle) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gold/8 px-2.5 pb-2.5 pt-2">
              {/* AP + Dice row */}
              <div className="mb-2 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold uppercase text-gold-dim">AP</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: combatant.maxActionPoints }).map((_, i) => (
                      <div key={i} className={`h-1.5 w-2.5 rounded-sm ${
                        i < combatant.actionPoints ? 'bg-gold' : 'bg-ink-muted/15'
                      }`} />
                    ))}
                  </div>
                </div>
                {combatant.team === 'player' && (
                  <div className="flex items-center gap-1">
                    <Dice5 className="h-3 w-3 text-gold-dim" />
                    <span className="text-[10px] font-bold text-ink">{combatant.diceRollsRemaining}</span>
                  </div>
                )}
              </div>

              {/* Stat chips */}
              <div className="grid grid-cols-4 gap-1">
                <div className="flex items-center gap-1 rounded-sm border border-ember/15 bg-ember/5 px-1.5 py-1 text-[9px]">
                  <Sword className="h-2.5 w-2.5 text-ember" />
                  <span className="font-bold text-ember">{attrs.ataque}</span>
                </div>
                <div className="flex items-center gap-1 rounded-sm border border-blue-400/15 bg-blue-400/5 px-1.5 py-1 text-[9px]">
                  <Shield className="h-2.5 w-2.5 text-blue-400" />
                  <span className="font-bold text-blue-400">{attrs.defesa}</span>
                </div>
                <div className="flex items-center gap-1 rounded-sm border border-gold/15 bg-gold/5 px-1.5 py-1 text-[9px]">
                  <Zap className="h-2.5 w-2.5 text-gold" />
                  <span className="font-bold text-gold">{attrs.velocidade}</span>
                </div>
                <div className="flex items-center gap-1 rounded-sm border border-arcane/15 bg-arcane/5 px-1.5 py-1 text-[9px]">
                  <Sparkles className="h-2.5 w-2.5 text-arcane" />
                  <span className="font-bold text-arcane">{attrs.magia}</span>
                </div>
              </div>

              {/* Status effects */}
              {combatant.statusEffects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {combatant.statusEffects.map((eff) => (
                    <span
                      key={eff.id}
                      className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: eff.color + '12', borderColor: eff.color + '30', color: eff.color }}
                    >
                      {eff.name} <span className="opacity-60">({eff.duration})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* bottom accent */}
      {isCurrent && (
        <div className={`absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent ${
          team === 'player' ? 'via-glow/20' : 'via-crimson/20'
        } to-transparent`} />
      )}
    </div>
  )
}

function ActionButton({
  icon,
  label,
  active,
  disabled,
  variant = 'default',
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  variant?: 'default' | 'muted' | 'end-turn'
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.04, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center gap-1 overflow-hidden border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
        disabled
          ? 'cursor-not-allowed border-ink-muted/8 bg-obsidian/20 text-ink-muted/30'
          : active
          ? 'border-gold/50 bg-gold/15 text-gold shadow-[0_0_10px_rgba(201,168,76,0.2)]'
          : variant === 'end-turn'
          ? 'border-ember/40 bg-ember/15 text-ember shadow-[0_0_8px_rgba(255,107,53,0.2)] hover:bg-ember/25 hover:text-white hover:shadow-[0_0_14px_rgba(255,107,53,0.3)]'
          : variant === 'muted'
          ? 'border-ink-muted/15 bg-surface/30 text-ink-muted hover:border-gold/20 hover:text-gold'
          : 'border-gold/15 bg-surface/30 text-ink hover:border-gold/30 hover:bg-gold/8 hover:text-gold'
      }`}
      style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}
    >
      {/* Active top accent */}
      {active && <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-gold/60 to-transparent" />}
      {variant === 'end-turn' && !disabled && <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-ember/60 to-transparent" />}
      {icon}
      {label}
    </motion.button>
  )
}

/* ══════════════════════════════════════════════
   Dice Roll Overlay — animated rolling d20
   ══════════════════════════════════════════════ */

function DiceRollOverlay({
  result,
  purpose,
  narration,
}: {
  result: DiceRollResult
  purpose: string
  narration: string | null
}) {
  const [phase, setPhase] = useState<'rolling' | 'reveal'>('rolling')
  const [rollingValue, setRollingValue] = useState(1)

  // Animate rolling numbers for 2.5 seconds, then reveal
  useEffect(() => {
    const interval = setInterval(() => {
      setRollingValue(Math.floor(Math.random() * 20) + 1)
    }, 80)

    const revealTimer = setTimeout(() => {
      clearInterval(interval)
      setRollingValue(result.roll)
      setPhase('reveal')
    }, 2500)

    return () => {
      clearInterval(interval)
      clearTimeout(revealTimer)
    }
  }, [result.roll])

  const purposeLabel =
    purpose === 'attack' ? 'Ataque'
    : purpose === 'defense' ? 'Defesa'
    : purpose === 'skill' ? 'Habilidade'
    : 'Movimento'

  const resultColor =
    result.isCrit ? 'border-gold text-gold'
    : result.isCritFail ? 'border-crimson text-crimson'
    : result.success ? 'border-glow text-glow'
    : 'border-ink-muted text-ink-muted'

  const resultBg =
    result.isCrit ? 'bg-gold/10'
    : result.isCritFail ? 'bg-crimson/10'
    : result.success ? 'bg-glow/10'
    : 'bg-ink-muted/5'

  return (
    <motion.div
      key="dice-roll"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.5, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className={`mx-4 max-w-sm rounded-2xl border-2 bg-panel p-6 text-center shadow-2xl ${
          phase === 'reveal' ? resultColor : 'border-gold/40 text-gold'
        }`}
      >
        {/* Purpose label */}
        <p className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">
          🎲 Dado de {purposeLabel}
        </p>

        {/* Rolling / Final dice value */}
        <motion.div
          animate={phase === 'rolling' ? { rotate: [0, 15, -15, 10, -10, 0], scale: [1, 1.1, 0.95, 1.05, 1] } : { rotate: 0, scale: 1 }}
          transition={phase === 'rolling' ? { repeat: Infinity, duration: 0.4 } : { type: 'spring', duration: 0.5 }}
          className="mb-3 inline-block"
        >
          <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-xl ${
            phase === 'reveal' ? resultBg : 'bg-gold/5'
          } border ${phase === 'reveal' ? resultColor : 'border-gold/30'}`}>
            <span className={`font-display text-5xl font-bold ${
              phase === 'rolling' ? 'text-gold opacity-60' : ''
            }`}>
              {rollingValue}
            </span>
          </div>
        </motion.div>

        {phase === 'rolling' && (
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-sm text-gold-dim"
          >
            Rolando...
          </motion.p>
        )}

        {phase === 'reveal' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-xs opacity-60">DC {result.difficulty}</p>
            <p className="mt-1 font-display text-xl font-bold">
              {result.isCrit
                ? '✨ CRÍTICO!'
                : result.isCritFail
                ? '💀 FALHA CRÍTICA!'
                : result.success
                ? '⚔️ Sucesso!'
                : '❌ Falha'}
            </p>
            <p className="mt-1 text-[10px] opacity-50">
              {result.success
                ? purpose === 'move' ? 'Movimento ampliado para 5 tiles!'
                  : purpose === 'attack' ? `Dano aumentado em ${result.isCrit ? '100' : '50'}%!`
                  : purpose === 'defense' ? 'Defesa reforçada!'
                  : `Efeito ampliado em ${result.isCrit ? '100' : '50'}%!`
                : 'O resultado não favoreceu o herói.'}
            </p>
            {narration && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-3 rounded-lg border border-gold/10 bg-obsidian/30 p-2 text-[11px] italic text-ink-muted"
              >
                {narration}
              </motion.p>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
