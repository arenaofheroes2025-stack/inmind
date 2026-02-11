import { AnimatePresence, motion } from 'framer-motion'
import { Dice5, Package, Sparkles, Users, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Character, Equipment } from '../data/types'
import type { RollResult } from '../utils/dice'
import { rollD20 } from '../utils/dice'
import { getEquipment } from '../services/cache'
import { CharacterDetailCard } from './CharacterDetailCard'
import { CharacterPortrait } from './CharacterPortrait'
import { TAG_STYLES } from './NarrativeText'
import type { NarrativeTag } from './NarrativeText'

type Props = {
  open: boolean
  actionDescription: string
  attribute: string
  partyCharacters: Character[]
  difficulty: number
  riskLevel: 'low' | 'medium' | 'high'
  affectsInventory?: boolean
  targetTag?: NarrativeTag | null
  onResult: (result: RollResult) => void
  onClose: () => void
  onItemUsed?: (characterId: string, equipmentId: string) => void
}

const ATTR_LABELS: Record<string, string> = {
  forca: 'Forca',
  agilidade: 'Agilidade',
  intelecto: 'Intelecto',
  carisma: 'Carisma',
  vontade: 'Vontade',
  percepcao: 'Percepcao',
}

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixo', color: 'text-glow' },
  medium: { label: 'Medio', color: 'text-gold' },
  high: { label: 'Alto', color: 'text-ember' },
}

const OUTCOME_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; glow: string; emoji: string }
> = {
  critical: {
    label: 'Sucesso Critico!',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-400/40',
    glow: 'shadow-[0_0_60px_rgba(52,211,153,0.3)]',
    emoji: '✦',
  },
  success: {
    label: 'Sucesso!',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-400/30',
    glow: 'shadow-[0_0_40px_rgba(74,222,128,0.2)]',
    emoji: '◆',
  },
  partial: {
    label: 'Sucesso Parcial',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-400/30',
    glow: 'shadow-[0_0_30px_rgba(250,204,21,0.15)]',
    emoji: '◇',
  },
  fail: {
    label: 'Falha',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-400/30',
    glow: 'shadow-[0_0_30px_rgba(251,146,60,0.15)]',
    emoji: '✗',
  },
  'critical-fail': {
    label: 'Falha Critica!',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-red-400/40',
    glow: 'shadow-[0_0_50px_rgba(248,113,113,0.25)]',
    emoji: '☠',
  },
}

const ROLL_DURATION = 3000 // 3 seconds of dice animation
const TICK_INITIAL = 50 // ms between number changes (start fast)
const TICK_FINAL = 250 // ms between number changes (slow down)

export function DiceRollModal({
  open,
  actionDescription,
  attribute,
  partyCharacters,
  difficulty,
  riskLevel,
  affectsInventory,
  targetTag,
  onResult,
  onClose,
  onItemUsed,
}: Props) {
  const [phase, setPhase] = useState<'ready' | 'rolling' | 'result'>('ready')
  const [displayNumber, setDisplayNumber] = useState(20)
  const [rollResult, setRollResult] = useState<RollResult | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const rollStartRef = useRef(0)
  const resultReported = useRef(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [detailChar, setDetailChar] = useState<Character | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [resolvedUsableItems, setResolvedUsableItems] = useState<{ inv: { id: string; equipmentId: string; quantity: number }; eq: Equipment }[]>([])

  /* ── resolve modifier from any character ── */
  const resolveModForChar = (char: Character, attr: string): number => {
    const a = char.actionAttributes
    switch (attr) {
      case 'forca': return a.forca
      case 'agilidade': return a.agilidade
      case 'carisma': return a.carisma
      case 'vontade': return a.vontade
      case 'percepcao': return a.percepcao
      case 'intelecto': default: return a.intelecto
    }
  }

  const bestCharacterId = useMemo(() => {
    if (!partyCharacters.length) return null
    let best = partyCharacters[0]
    let bestVal = resolveModForChar(best, attribute)
    for (const pc of partyCharacters) {
      const v = resolveModForChar(pc, attribute)
      if (v > bestVal) { best = pc; bestVal = v }
    }
    return best.id
  }, [partyCharacters, attribute])

  const activeCharacterId = selectedCharacterId ?? bestCharacterId
  const activeCharacter = partyCharacters.find(c => c.id === activeCharacterId) ?? partyCharacters[0] ?? null
  const baseModifier = activeCharacter ? resolveModForChar(activeCharacter, attribute) : 0

  // Calculate item bonus on modifier and difficulty reduction
  const selectedItem = resolvedUsableItems.find((r) => r.inv.equipmentId === selectedItemId)
  const itemAttrBonus = selectedItem?.eq?.bonus?.[attribute] ?? 0
  const modifier = baseModifier + itemAttrBonus
  const itemDiffReduction = selectedItem?.eq?.difficultyReduction ?? 0
  const effectiveDifficulty = Math.max(1, difficulty - itemDiffReduction)

  // Resolve usable items from active character's inventory
  useEffect(() => {
    if (!open || !activeCharacter) { setResolvedUsableItems([]); return }
    const usable = activeCharacter.inventory.filter((inv) => inv.quantity > 0)
    if (usable.length === 0) { setResolvedUsableItems([]); return }
    Promise.all(usable.map(async (inv) => {
      const eq = await getEquipment(inv.equipmentId)
      if (!eq) return null
      // Only show items usable pre-action (consumables that reduce difficulty or boost attrs)
      if (eq.usageContext !== 'pre-acao' && eq.usageContext !== 'ambos') return null
      return { inv, eq }
    })).then((results) => {
      setResolvedUsableItems(results.filter(Boolean) as { inv: { id: string; equipmentId: string; quantity: number }; eq: Equipment }[])
    })
  }, [open, activeCharacter, activeCharacter?.inventory.length])

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setPhase('ready')
      setDisplayNumber(20)
      setRollResult(null)
      resultReported.current = false
      setSelectedCharacterId(null)
      setDetailChar(null)
      setSelectedItemId(null)
    }
  }, [open])

  // Dice rolling animation
  const animateDice = useCallback(
    (finalValue: number) => {
      rollStartRef.current = Date.now()

      const tick = () => {
        const elapsed = Date.now() - rollStartRef.current
        const progress = Math.min(elapsed / ROLL_DURATION, 1)

        if (progress < 1) {
          // Ease out — slow down towards the end
          const intervalMs =
            TICK_INITIAL + (TICK_FINAL - TICK_INITIAL) * Math.pow(progress, 2)
          setDisplayNumber(Math.floor(Math.random() * 20) + 1)
          animFrameRef.current = window.setTimeout(
            () => tick(),
            intervalMs,
          ) as unknown as number
        } else {
          // Final value
          setDisplayNumber(finalValue)
          // Short pause then show result
          setTimeout(() => {
            setPhase('result')
          }, 400)
        }
      }

      tick()
    },
    [],
  )

  const handleRoll = useCallback(() => {
    if (phase !== 'ready') return
    setPhase('rolling')
    const result = rollD20(modifier, effectiveDifficulty)
    setRollResult(result)
    animateDice(result.raw)
    // Consume selected item if it's consumable
    if (selectedItemId && activeCharacter) {
      onItemUsed?.(activeCharacter.id, selectedItemId)
    }
  }, [phase, modifier, effectiveDifficulty, animateDice, selectedItemId, activeCharacter, onItemUsed])

  // Report result when transitioning to result phase
  useEffect(() => {
    if (phase === 'result' && rollResult && !resultReported.current) {
      resultReported.current = true
      onResult({ ...rollResult, characterName: activeCharacter?.name })
    }
  }, [phase, rollResult, onResult, activeCharacter])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        clearTimeout(animFrameRef.current)
      }
    }
  }, [])

  const risk = RISK_LABELS[riskLevel] ?? RISK_LABELS.medium
  const outcome = rollResult ? OUTCOME_CONFIG[rollResult.outcome] : null

  if (!open) return null

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            className={`relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border bg-gradient-to-b from-panel via-surface to-panel ${
              phase === 'result' && outcome
                ? `${outcome.border} ${outcome.glow}`
                : 'border-gold/20 shadow-[0_0_60px_rgba(201,168,76,0.1)]'
            }`}
          >
            {/* top accent line */}
            <div
              className={`absolute inset-x-0 top-0 h-1 ${
                phase === 'result' && outcome
                  ? `${outcome.bg}`
                  : 'bg-gradient-to-r from-transparent via-gold/40 to-transparent'
              }`}
            />

            {/* close button */}
            {phase !== 'rolling' && (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="px-6 pb-6 pt-5">
              {/* ── ACTIVE CHARACTER HEADER ── */}
              {activeCharacter && (
                <div className="mb-4 flex items-center gap-3 border-b border-gold/10 pb-4">
                  <CharacterPortrait
                    src={activeCharacter.portraitUrl}
                    fallback={activeCharacter.name[0]?.toUpperCase()}
                    size="md"
                    variant="circle"
                    active
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{activeCharacter.name}</p>
                    <p className="text-[10px] text-ink-muted">
                      {activeCharacter.archetype} — Nv {activeCharacter.level ?? 1}
                    </p>
                  </div>
                </div>
              )}

              {/* ── ACTION DETAILS ── */}
              <div className="mb-5">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold/60">
                  <Zap className="h-3 w-3" />
                  Acao escolhida
                </p>
                <p className="mt-2 font-display text-sm font-bold text-ink">
                  {actionDescription}
                </p>

                {/* selected target tag */}
                {targetTag && (() => {
                  const ts = TAG_STYLES[targetTag.category]
                  return (
                    <div className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${ts.text} ${ts.bg} ${ts.border}`}>
                      <span className="text-[10px] opacity-70">{ts.icon}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-60">{targetTag.label}:</span>
                      {targetTag.text}
                    </div>
                  )
                })()}

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* attribute badge */}
                  <span className="flex items-center gap-1.5 rounded-full border border-gold/15 bg-gold/5 px-2.5 py-1 text-[10px] font-semibold text-gold">
                    <Sparkles className="h-3 w-3" />
                    {ATTR_LABELS[attribute] ?? attribute}
                    {modifier !== 0 && (
                      <span className={modifier > 0 ? 'text-glow' : 'text-ember'}>
                        ({modifier > 0 ? '+' : ''}{modifier})
                      </span>
                    )}
                  </span>
                  {/* difficulty badge */}
                  <span className="rounded-full border border-ink/15 bg-ink/5 px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
                    Dificuldade: {difficulty}
                  </span>
                  {/* risk badge */}
                  <span className={`rounded-full border border-ink/15 bg-ink/5 px-2.5 py-1 text-[10px] font-semibold ${risk.color}`}>
                    Risco {risk.label}
                  </span>
                  {/* inventory impact */}
                  {affectsInventory && (
                    <span className="flex items-center gap-1 rounded-full border border-glow/25 bg-glow/8 px-2.5 py-1 text-[10px] font-semibold text-glow">
                      <Package className="h-3 w-3" />
                      Pode obter item
                    </span>
                  )}
                </div>
              </div>

              {/* ── PRE-ACTION ITEM USAGE ── */}
              {phase === 'ready' && resolvedUsableItems.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold/60">
                    <Package className="h-3 w-3" />
                    Usar item antes de rolar?
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {resolvedUsableItems.map(({ inv, eq }) => {
                      const isSelected = selectedItemId === inv.equipmentId
                      const bonusText: string[] = []
                      const attrBonus = eq.bonus?.[attribute]
                      if (attrBonus && attrBonus > 0) bonusText.push(`+${attrBonus} ${ATTR_LABELS[attribute] ?? attribute}`)
                      if (eq.difficultyReduction && eq.difficultyReduction > 0) bonusText.push(`−${eq.difficultyReduction} Dific.`)
                      if (eq.hpRestore && eq.hpRestore > 0) bonusText.push(`+${eq.hpRestore} HP`)
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => setSelectedItemId(isSelected ? null : inv.equipmentId)}
                          className={`relative flex min-w-[80px] flex-col items-center gap-1 rounded-xl border p-2 transition-all ${
                            isSelected
                              ? 'border-glow/50 bg-glow/10 shadow-[0_0_15px_rgba(74,222,128,0.15)]'
                              : 'border-ink/10 bg-panel/50 hover:border-ink/20'
                          }`}
                        >
                          <span className="text-lg">
                            {eq.type === 'pocao' ? '🧪' : eq.type === 'pergaminho' ? '📜' : '✦'}
                          </span>
                          <span className="max-w-[70px] truncate text-[9px] font-semibold text-ink">
                            {eq.name}
                          </span>
                          {bonusText.length > 0 && (
                            <span className="text-[8px] font-bold text-glow">
                              {bonusText.join(' ')}
                            </span>
                          )}
                          {inv.quantity > 1 && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-obsidian">
                              {inv.quantity}
                            </span>
                          )}
                          {eq.consumable && (
                            <span className="text-[7px] text-ember/60">consumível</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {selectedItem && (
                    <div className="mt-1.5 rounded-lg border border-glow/15 bg-glow/5 px-3 py-1.5">
                      <p className="text-[10px] text-glow/80">
                        <span className="font-bold">{selectedItem.eq.name}</span>
                        {selectedItem.eq.consumable && ' (será consumido ao rolar)'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── PARTY SELECTOR ── */}
              {phase === 'ready' && partyCharacters.length > 1 && (
                <div className="mb-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold/60">
                    <Users className="h-3 w-3" />
                    Quem realiza a acao?
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {partyCharacters.map((pc) => {
                      const attrVal = resolveModForChar(pc, attribute)
                      const isBest = pc.id === bestCharacterId
                      const isSelected = pc.id === activeCharacterId
                      return (
                        <button
                          key={pc.id}
                          type="button"
                          onClick={() => setSelectedCharacterId(pc.id)}
                          className={`relative flex min-w-[72px] flex-col items-center gap-1 rounded-xl border p-2 transition-all ${
                            isSelected
                              ? 'border-gold/50 bg-gold/10 shadow-[0_0_15px_rgba(201,168,76,0.15)]'
                              : 'border-ink/10 bg-panel/50 hover:border-ink/20'
                          }`}
                        >
                          {isBest && (
                            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-obsidian">
                              ★
                            </div>
                          )}
                          <CharacterPortrait
                            src={pc.portraitUrl}
                            fallback={pc.name[0]?.toUpperCase()}
                            size="xs"
                            variant="circle"
                            active={isSelected}
                          />
                          <span className="max-w-[60px] truncate text-[9px] font-semibold text-ink">
                            {pc.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${isBest ? 'text-gold' : 'text-ink-muted'}`}
                          >
                            {ATTR_LABELS[attribute] ?? attribute}{' '}
                            {attrVal > 0 ? '+' : ''}
                            {attrVal}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailChar(pc)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation()
                                setDetailChar(pc)
                              }
                            }}
                            className="text-[8px] text-ink-muted underline hover:text-gold"
                          >
                            detalhes
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── DICE AREA ── */}
              <div className="relative flex flex-col items-center py-4">
                {/* d20 display */}
                <motion.div
                  className={`relative flex h-32 w-32 items-center justify-center ${
                    phase === 'rolling' ? '' : ''
                  }`}
                  animate={
                    phase === 'rolling'
                      ? {
                          rotate: [0, 15, -10, 8, -5, 0],
                          scale: [1, 1.08, 0.95, 1.05, 1],
                        }
                      : phase === 'result'
                        ? { scale: [1.15, 1], rotate: 0 }
                        : {}
                  }
                  transition={
                    phase === 'rolling'
                      ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.4, type: 'spring' }
                  }
                >
                  {/* d20 shape background */}
                  <div
                    className={`absolute inset-0 rotate-45 rounded-xl border-2 transition-colors duration-300 ${
                      phase === 'result' && outcome
                        ? `${outcome.border} ${outcome.bg}`
                        : phase === 'rolling'
                          ? 'border-gold/40 bg-gold/10'
                          : 'border-gold/20 bg-gold/5'
                    }`}
                  />
                  <div
                    className={`absolute inset-2 rotate-[22deg] rounded-xl border transition-colors duration-300 ${
                      phase === 'result' && outcome
                        ? `${outcome.border}`
                        : 'border-gold/15'
                    }`}
                  />

                  {/* number */}
                  <motion.span
                    key={displayNumber}
                    initial={phase === 'rolling' ? { scale: 0.6, opacity: 0.3 } : {}}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.08 }}
                    className={`relative z-10 font-display-decorative text-4xl font-black ${
                      phase === 'result' && outcome
                        ? outcome.color
                        : phase === 'rolling'
                          ? 'text-gold'
                          : 'text-ink'
                    }`}
                  >
                    {displayNumber}
                  </motion.span>

                  {/* rolling particles */}
                  {phase === 'rolling' && (
                    <>
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={`particle-${i}`}
                          className="absolute h-1.5 w-1.5 rounded-full bg-gold/60"
                          animate={{
                            x: [0, Math.cos((i * Math.PI) / 3) * 70],
                            y: [0, Math.sin((i * Math.PI) / 3) * 70],
                            opacity: [0.8, 0],
                            scale: [1, 0.3],
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.12,
                            ease: 'easeOut',
                          }}
                        />
                      ))}
                    </>
                  )}
                </motion.div>

                {/* modifier breakdown (during rolling / result) */}
                {phase !== 'ready' && rollResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: phase === 'result' ? 0.2 : 0 }}
                    className="mt-4 flex items-center gap-2 text-sm"
                  >
                    <span className="font-mono text-ink-muted">d20</span>
                    <span className={`font-display text-xl font-bold ${
                      phase === 'result' && outcome ? outcome.color : 'text-gold'
                    }`}>
                      {phase === 'result' ? rollResult.raw : '?'}
                    </span>
                    {modifier !== 0 && (
                      <>
                        <span className="text-ink-muted">+</span>
                        <span className="font-display text-lg font-bold text-gold">
                          {modifier}
                        </span>
                        <span className="text-[10px] text-ink-muted">
                          ({ATTR_LABELS[attribute] ?? attribute})
                        </span>
                      </>
                    )}
                    {phase === 'result' && (
                      <>
                        <span className="text-ink-muted">=</span>
                        <span className={`font-display text-xl font-bold ${
                          outcome ? outcome.color : 'text-ink'
                        }`}>
                          {rollResult.total}
                        </span>
                      </>
                    )}
                  </motion.div>
                )}

                {/* target display */}
                {phase === 'result' && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-1 text-[11px] text-ink-muted"
                  >
                    Necessario: <span className="font-bold text-ink">{effectiveDifficulty}</span>
                    {itemDiffReduction > 0 && (
                      <span className="ml-1 text-glow">(−{itemDiffReduction} item)</span>
                    )}
                    {rollResult && rollResult.total >= effectiveDifficulty
                      ? <span className="ml-1.5 text-glow">✓ alcancado</span>
                      : <span className="ml-1.5 text-ember">✗ nao alcancado</span>
                    }
                  </motion.p>
                )}
              </div>

              {/* ── OUTCOME BANNER ── */}
              <AnimatePresence>
                {phase === 'result' && outcome && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', damping: 16, stiffness: 180 }}
                    className={`mb-4 mt-2 rounded-xl border p-4 text-center ${outcome.border} ${outcome.bg}`}
                  >
                    <p className={`font-display-decorative text-xl font-black ${outcome.color}`}>
                      {outcome.emoji} {outcome.label} {outcome.emoji}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                      {rollResult?.outcome === 'critical'
                        ? 'Sucesso critico! Uma porta se abre mais alem.'
                        : rollResult?.outcome === 'success'
                          ? 'Sucesso. A historia se inclina a seu favor.'
                          : rollResult?.outcome === 'partial'
                            ? 'Sucesso parcial. Voce ganha, mas paga um preco.'
                            : rollResult?.outcome === 'fail'
                              ? 'Falha. O mundo reage contra voce.'
                              : 'Falha critica! Consequencias duradouras aguardam.'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── ACTION BUTTONS ── */}
              <div className="flex gap-3">
                {phase === 'ready' && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-xl border border-ink/15 bg-panel/80 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:border-ink/25 hover:text-ink"
                    >
                      Cancelar
                    </button>
                    <motion.button
                      type="button"
                      onClick={handleRoll}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/5 py-3 text-xs font-bold uppercase tracking-wider text-gold shadow-[0_0_20px_rgba(201,168,76,0.1)] transition-all hover:shadow-[0_0_30px_rgba(201,168,76,0.2)]"
                    >
                      <Dice5 className="h-4 w-4" />
                      Rolar Dado
                    </motion.button>
                  </>
                )}

                {phase === 'rolling' && (
                  <div className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-gold">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Dice5 className="h-5 w-5" />
                    </motion.div>
                    Rolando...
                  </div>
                )}

                {phase === 'result' && (
                  <motion.button
                    type="button"
                    onClick={onClose}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full rounded-xl border py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                      outcome
                        ? `${outcome.border} ${outcome.bg} ${outcome.color}`
                        : 'border-gold/20 text-gold'
                    }`}
                  >
                    Continuar
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {detailChar && (
      <CharacterDetailCard character={detailChar} open onClose={() => setDetailChar(null)} />
    )}
    </>
  )
}
