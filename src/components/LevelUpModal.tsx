import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUp,
  ChevronUp,
  Minus,
  Plus,
  Shield,
  Sparkles,
  Star,
  Sword,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import type { Character, ActionAttributes, BattleAttributes } from '../data/types'
import { CharacterPortrait } from './CharacterPortrait'
import { ChoiceButton } from './ChoiceButton'

type Props = {
  open: boolean
  character: Character
  newLevel: number
  onConfirm: (actionDeltas: Partial<ActionAttributes>, battleDeltas: Partial<BattleAttributes>) => void
}

const POINTS_PER_LEVEL = 3

const ACTION_ATTRS: { key: keyof ActionAttributes; label: string; icon: typeof Sword }[] = [
  { key: 'forca', label: 'Forca', icon: Sword },
  { key: 'agilidade', label: 'Agilidade', icon: Zap },
  { key: 'intelecto', label: 'Intelecto', icon: Star },
  { key: 'carisma', label: 'Carisma', icon: Sparkles },
  { key: 'vontade', label: 'Vontade', icon: Shield },
  { key: 'percepcao', label: 'Percepcao', icon: ArrowUp },
]

const BATTLE_ATTRS: { key: keyof BattleAttributes; label: string; icon: typeof Sword }[] = [
  { key: 'velocidade', label: 'Velocidade', icon: Zap },
  { key: 'ataque', label: 'Ataque', icon: Sword },
  { key: 'defesa', label: 'Defesa', icon: Shield },
  { key: 'magia', label: 'Magia', icon: Star },
]

export function LevelUpModal({ open, character, newLevel, onConfirm }: Props) {
  const [actionPts, setActionPts] = useState<Record<string, number>>({})
  const [battlePts, setBattlePts] = useState<Record<string, number>>({})

  const totalSpent =
    Object.values(actionPts).reduce((a, b) => a + b, 0) +
    Object.values(battlePts).reduce((a, b) => a + b, 0)
  const remaining = POINTS_PER_LEVEL - totalSpent

  const addAction = (key: string) => {
    if (remaining <= 0) return
    setActionPts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }
  const removeAction = (key: string) => {
    if ((actionPts[key] || 0) <= 0) return
    setActionPts((prev) => ({ ...prev, [key]: (prev[key] || 0) - 1 }))
  }
  const addBattle = (key: string) => {
    if (remaining <= 0) return
    setBattlePts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }
  const removeBattle = (key: string) => {
    if ((battlePts[key] || 0) <= 0) return
    setBattlePts((prev) => ({ ...prev, [key]: (prev[key] || 0) - 1 }))
  }

  const handleConfirm = () => {
    if (remaining !== 0) return
    onConfirm(actionPts as Partial<ActionAttributes>, battlePts as Partial<BattleAttributes>)
    setActionPts({})
    setBattlePts({})
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm" />

          {/* particles / sparkle overlay — reduced count for iOS performance */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-gold"
                style={{
                  left: `${15 + (i % 2) * 70}%`,
                  top: `${20 + (i < 2 ? 0 : 60)}%`,
                }}
                animate={{
                  y: [0, -24],
                  opacity: [0.6, 0],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: 'easeOut',
                }}
              />
            ))}
          </motion.div>

          {/* modal content */}
          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-b from-panel via-surface to-panel shadow-[0_0_60px_rgba(201,168,76,0.25)]"
            initial={{ scale: 0.85, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          >
            {/* gold accent top */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />

            {/* header */}
            <div className="relative flex flex-col items-center gap-3 px-6 pt-8 pb-4">
              {/* glow behind portrait */}
              <div className="absolute top-4 h-24 w-24 rounded-full bg-gold/20 blur-[40px]" />
              <CharacterPortrait
                src={character.portraitUrl}
                fallback={character.name[0]?.toUpperCase()}
                variant="arch"
                size="lg"
                active
              />
              <motion.div
                className="flex items-center gap-2"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <ChevronUp className="h-5 w-5 text-gold" />
                <h2 className="font-display text-2xl font-bold tracking-wide text-gold">
                  Nivel {newLevel}!
                </h2>
                <ChevronUp className="h-5 w-5 text-gold" />
              </motion.div>
              <p className="text-center text-sm text-ink-muted">
                <span className="font-bold text-ink">{character.name}</span> evoluiu!
                Distribua <span className="font-bold text-gold">{POINTS_PER_LEVEL} pontos</span> nos atributos.
              </p>
            </div>

            {/* divider */}
            <div className="mx-6 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />

            {/* attribute sections */}
            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              {/* remaining points badge */}
              <div className="mb-4 flex justify-center">
                <span className={`rounded-full border px-4 py-1 text-xs font-bold uppercase tracking-wider ${
                  remaining > 0
                    ? 'border-gold/30 bg-gold/10 text-gold'
                    : 'border-glow/30 bg-glow/10 text-glow'
                }`}>
                  {remaining > 0 ? `${remaining} ponto${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}` : 'Tudo distribuido!'}
                </span>
              </div>

              {/* action attributes */}
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-gold-dim">
                  <Sword className="h-3 w-3" /> Atributos de Acao
                </p>
                <div className="space-y-1.5">
                  {ACTION_ATTRS.map(({ key, label, icon: Icon }) => {
                    const base = character.actionAttributes[key]
                    const delta = actionPts[key] || 0
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-lg border border-ink/8 bg-surface/40 px-3 py-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-gold-dim" />
                        <span className="flex-1 text-xs font-medium text-ink">{label}</span>
                        <span className="w-8 text-center text-xs font-bold tabular-nums text-ink-muted">{base}</span>
                        {delta > 0 && (
                          <span className="text-xs font-bold text-glow">+{delta}</span>
                        )}
                        <span className="mx-1 text-xs text-ink-muted">=</span>
                        <span className="w-6 text-center text-xs font-bold tabular-nums text-gold">{base + delta}</span>
                        <div className="flex gap-px">
                          <button
                            type="button"
                            disabled={delta <= 0}
                            onClick={() => removeAction(key)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-ink/10 bg-surface/60 text-ink-muted transition-colors hover:border-ember/30 hover:text-ember disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={remaining <= 0}
                            onClick={() => addAction(key)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-ink/10 bg-surface/60 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold disabled:opacity-30"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* battle attributes */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-gold-dim">
                  <Shield className="h-3 w-3" /> Atributos de Batalha
                </p>
                <div className="space-y-1.5">
                  {BATTLE_ATTRS.map(({ key, label, icon: Icon }) => {
                    const base = character.battleAttributes[key]
                    const delta = battlePts[key] || 0
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-lg border border-ink/8 bg-surface/40 px-3 py-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-gold-dim" />
                        <span className="flex-1 text-xs font-medium text-ink">{label}</span>
                        <span className="w-8 text-center text-xs font-bold tabular-nums text-ink-muted">{base}</span>
                        {delta > 0 && (
                          <span className="text-xs font-bold text-glow">+{delta}</span>
                        )}
                        <span className="mx-1 text-xs text-ink-muted">=</span>
                        <span className="w-6 text-center text-xs font-bold tabular-nums text-gold">{base + delta}</span>
                        <div className="flex gap-px">
                          <button
                            type="button"
                            disabled={delta <= 0}
                            onClick={() => removeBattle(key)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-ink/10 bg-surface/60 text-ink-muted transition-colors hover:border-ember/30 hover:text-ember disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={remaining <= 0}
                            onClick={() => addBattle(key)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-ink/10 bg-surface/60 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold disabled:opacity-30"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="border-t border-gold/15 px-6 py-4">
              <ChoiceButton
                label={remaining > 0 ? `Distribua todos os ${POINTS_PER_LEVEL} pontos` : 'Confirmar evolucao'}
                variant={remaining === 0 ? 'gold' : 'ghost'}
                size="lg"
                icon={<Sparkles />}
                disabled={remaining !== 0}
                onClick={handleConfirm}
                className="w-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
