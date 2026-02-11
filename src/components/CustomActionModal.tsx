import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Dice5,
  Loader2,
  Pen,
  Shield,
  SkipForward,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { Character } from '../data/types'
import type {
  CustomActionInput,
  NarrativeContext,
  ValidatedAction,
} from '../services/narrativeEngine'
import { validateCustomActions } from '../services/narrativeEngine'
import { CharacterPortrait } from './CharacterPortrait'

type Props = {
  open: boolean
  partyCharacters: Character[]
  narrativeContext: NarrativeContext | null
  onStartRolls: (actions: ValidatedAction[]) => void
  onClose: () => void
}

const ATTR_LABELS: Record<string, string> = {
  forca: 'Forca',
  agilidade: 'Agilidade',
  intelecto: 'Intelecto',
  carisma: 'Carisma',
  vontade: 'Vontade',
  percepcao: 'Percepcao',
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-glow',
  medium: 'text-gold',
  high: 'text-ember',
}

type CharacterAction = {
  characterId: string
  actionText: string
  skip: boolean
}

export function CustomActionModal({
  open,
  partyCharacters,
  narrativeContext,
  onStartRolls,
  onClose,
}: Props) {
  const [actions, setActions] = useState<CharacterAction[]>(() =>
    partyCharacters.map((c) => ({
      characterId: c.id,
      actionText: '',
      skip: false,
    })),
  )
  const [phase, setPhase] = useState<'input' | 'validating' | 'results'>(
    'input',
  )
  const [validatedActions, setValidatedActions] = useState<ValidatedAction[]>(
    [],
  )
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  const resetState = () => {
    setActions(
      partyCharacters.map((c) => ({
        characterId: c.id,
        actionText: '',
        skip: false,
      })),
    )
    setPhase('input')
    setValidatedActions([])
    setError(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const updateAction = (characterId: string, text: string) => {
    setActions((prev) =>
      prev.map((a) =>
        a.characterId === characterId ? { ...a, actionText: text } : a,
      ),
    )
  }

  const toggleSkip = (characterId: string) => {
    setActions((prev) =>
      prev.map((a) =>
        a.characterId === characterId
          ? { ...a, skip: !a.skip, actionText: a.skip ? a.actionText : '' }
          : a,
      ),
    )
  }

  const handleValidate = async () => {
    if (!narrativeContext) return

    const activeActions: CustomActionInput[] = actions
      .filter((a) => !a.skip && a.actionText.trim().length > 0)
      .map((a) => {
        const char = partyCharacters.find((c) => c.id === a.characterId)
        return {
          characterId: a.characterId,
          characterName: char?.name ?? 'Aventureiro',
          actionText: a.actionText.trim(),
        }
      })

    if (activeActions.length === 0) {
      setError('Pelo menos um personagem deve realizar uma acao.')
      return
    }

    setPhase('validating')
    setError(null)

    try {
      const results = await validateCustomActions(
        narrativeContext,
        activeActions,
      )
      setValidatedActions(results)
      setPhase('results')
    } catch (err) {
      console.error('[CustomActionModal] Validation failed:', err)
      setError('Falha ao validar acoes. Tente novamente.')
      setPhase('input')
    }
  }

  const handleStartRolls = () => {
    const validActions = validatedActions.filter((a) => a.valid)
    if (validActions.length === 0) {
      setError('Nenhuma acao valida. Reformule suas acoes.')
      setPhase('input')
      return
    }
    resetState()
    onStartRolls(validActions)
  }

  const hasAnyAction = actions.some(
    (a) => !a.skip && a.actionText.trim().length > 0,
  )
  const validCount = validatedActions.filter((a) => a.valid).length
  const invalidCount = validatedActions.filter((a) => !a.valid).length

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-frame border border-gold/20 bg-gradient-to-b from-panel to-surface shadow-[0_0_80px_rgba(201,168,76,0.1)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <Pen className="h-4 w-4 text-gold" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-ink">
                  Decisao Propria
                </h3>
                <p className="text-[10px] text-ink-muted">
                  {phase === 'input'
                    ? 'Cada jogador descreve sua acao livremente'
                    : phase === 'validating'
                      ? 'Validando acoes...'
                      : `${validCount} valida${validCount !== 1 ? 's' : ''}, ${invalidCount} invalida${invalidCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* INPUT PHASE */}
            {phase === 'input' && (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-ink-muted">
                  Descreva o que cada personagem deseja fazer. A acao sera
                  validada pela IA para verificar se faz sentido no contexto
                  atual. Se um personagem nao deseja agir, marque{' '}
                  <span className="font-semibold text-ink">
                    &quot;Nao fazer nada&quot;
                  </span>
                  .
                </p>

                {partyCharacters.map((char) => {
                  const action = actions.find(
                    (a) => a.characterId === char.id,
                  )
                  const isSkipped = action?.skip ?? false

                  return (
                    <div
                      key={char.id}
                      className={`overflow-hidden rounded-frame border transition-all ${
                        isSkipped
                          ? 'border-ink/10 bg-surface/30 opacity-60'
                          : 'border-gold/15 bg-panel/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <CharacterPortrait
                          src={char.portraitUrl}
                          fallback={char.name[0]?.toUpperCase()}
                          variant="circle"
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-ink">
                            {char.name}
                          </p>
                          <p className="text-[10px] text-ink-muted">
                            {char.archetype} — Nv {char.level ?? 1}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSkip(char.id)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
                            isSkipped
                              ? 'border-gold/20 bg-gold/10 text-gold'
                              : 'border-ink/15 text-ink-muted hover:border-ember/20 hover:text-ember'
                          }`}
                        >
                          <SkipForward className="h-3 w-3" />
                          {isSkipped ? 'Vai agir' : 'Pular'}
                        </button>
                      </div>

                      {!isSkipped && (
                        <div className="border-t border-ink/8 px-4 py-3">
                          <textarea
                            value={action?.actionText ?? ''}
                            onChange={(e) =>
                              updateAction(char.id, e.target.value)
                            }
                            placeholder={`O que ${char.name} deseja fazer? (ex: "Investigo os barris escondidos atras da taverna")`}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-ink/15 bg-obsidian/40 px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-muted/40 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-xs text-ember">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* VALIDATING PHASE */}
            {phase === 'validating' && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
                <p className="text-sm text-ink-muted">
                  Validando acoes com o mestre...
                </p>
              </div>
            )}

            {/* RESULTS PHASE */}
            {phase === 'results' && (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-ink-muted">
                  Resultado da validacao. Acoes validas terao rolagem de dado.
                </p>

                {validatedActions.map((va) => {
                  const char = partyCharacters.find(
                    (c) => c.id === va.characterId,
                  )
                  return (
                    <div
                      key={va.characterId}
                      className={`overflow-hidden rounded-frame border ${
                        va.valid
                          ? 'border-glow/20 bg-glow/5'
                          : 'border-ember/20 bg-ember/5'
                      }`}
                    >
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            va.valid ? 'bg-glow/20' : 'bg-ember/20'
                          }`}
                        >
                          {va.valid ? (
                            <Check className="h-3 w-3 text-glow" />
                          ) : (
                            <X className="h-3 w-3 text-ember" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {char && (
                              <CharacterPortrait
                                src={char.portraitUrl}
                                fallback={char.name[0]?.toUpperCase()}
                                variant="circle"
                                size="xs"
                              />
                            )}
                            <p className="text-xs font-bold text-ink">
                              {va.characterName}
                            </p>
                          </div>

                          {va.valid ? (
                            <>
                              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                                {va.description}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1 rounded-full border border-gold/15 bg-gold/5 px-2 py-0.5 text-[10px] font-semibold text-gold">
                                  <Shield className="h-3 w-3" />
                                  {ATTR_LABELS[va.primaryAttribute] ??
                                    va.primaryAttribute}
                                </span>
                                <span className="flex items-center gap-1 rounded-full border border-ink/15 bg-ink/5 px-2 py-0.5 text-[10px] text-ink-muted">
                                  <Dice5 className="h-3 w-3" />
                                  Dif. {va.difficulty}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold ${RISK_COLORS[va.riskLevel] ?? 'text-ink-muted'}`}
                                >
                                  Risco:{' '}
                                  {va.riskLevel === 'low'
                                    ? 'Baixo'
                                    : va.riskLevel === 'high'
                                      ? 'Alto'
                                      : 'Medio'}
                                </span>
                              </div>
                            </>
                          ) : (
                            <p className="mt-1.5 text-xs leading-relaxed text-ember/80">
                              {va.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-xs text-ember">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gold/15 px-5 py-4">
            {phase === 'input' && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-ink/15 px-4 py-2 text-[11px] font-semibold text-ink-muted transition-colors hover:border-gold/20 hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={!hasAnyAction}
                  className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gold transition-all hover:bg-gold/20 disabled:opacity-40 disabled:hover:bg-gold/10"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Validar Acoes
                </button>
              </div>
            )}

            {phase === 'results' && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setPhase('input')
                    setValidatedActions([])
                    setError(null)
                  }}
                  className="rounded-lg border border-ink/15 px-4 py-2 text-[11px] font-semibold text-ink-muted transition-colors hover:border-gold/20 hover:text-ink"
                >
                  Reformular
                </button>
                {validCount > 0 && (
                  <button
                    type="button"
                    onClick={handleStartRolls}
                    className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/15 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gold transition-all hover:bg-gold/25 hover:shadow-[0_0_16px_rgba(201,168,76,0.15)]"
                  >
                    <Dice5 className="h-3.5 w-3.5" />
                    Rolar Dados ({validCount})
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
