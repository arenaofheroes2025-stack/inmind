import { AnimatePresence, motion } from 'framer-motion'
import {

  BookOpen,
  ChevronRight,
  Compass,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  Heart,
  MapPin,
  Shield,
  Sparkles,
  Star,
  Sword,
  Swords,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { CharacterPortrait } from '../components/CharacterPortrait'
import { ChoiceButton } from '../components/ChoiceButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { HPBar } from '../components/HPBar'
import { StatChip } from '../components/StatChip'
import type { Character } from '../data/types'
import { listCharactersByWorld, saveCharacter } from '../services/cache'
import { useGameStore } from '../store/useGameStore'
import { useNavigateGame } from '../app/routes'

const MAX_PARTY = 4

const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
}
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
}

export function CharacterHubScreen() {
  const world = useGameStore((state) => state.world)
  const currentWorldId = useGameStore((state) => state.currentWorldId)
  const savedCharacters = useGameStore((state) => state.savedCharacters)
  const setSavedCharacters = useGameStore((state) => state.setSavedCharacters)
  const { goEditCharacter, goNewCharacter, goPlay, goMenu } = useNavigateGame()

  const worldId = world?.id ?? currentWorldId
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [charsReady, setCharsReady] = useState(false)

  useEffect(() => {
    if (!worldId) return
    let mounted = true
    setCharsReady(false)
    const loadCharacters = async () => {
      const characters = await listCharactersByWorld(worldId)
      if (mounted) {
        setSavedCharacters(characters)
        setCharsReady(true)
      }
    }
    loadCharacters()
    return () => { mounted = false }
  }, [setSavedCharacters, worldId])

  const activeCharacters = savedCharacters.filter((c) => !c.disabled)
  const canCreate = savedCharacters.length < MAX_PARTY

  const handleToggle = async (character: Character) => {
    const isCurrentlyDisabled = !!character.disabled
    // If enabling and already at max, don't allow
    if (isCurrentlyDisabled && activeCharacters.length >= MAX_PARTY) return
    const updated = { ...character, disabled: !isCurrentlyDisabled }
    await saveCharacter(updated)
    setSavedCharacters(savedCharacters.map((c) => (c.id === updated.id ? updated : c)))
  }

  const handleEdit = (character: Character) => {
    if (!worldId) return
    goEditCharacter(worldId, character.id)
  }

  const [selectedChar, setSelectedChar] = useState<Character | null>(null)

  return (
    <>
      {/* ═══ FULL-SCREEN BACKGROUND ═══ */}
      {world?.mapUrl && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <img src={world.mapUrl} alt="" className="h-full w-full object-cover blur-md saturate-[0.3] opacity-20" />
          <div className="absolute inset-0 bg-obsidian/70" />
        </div>
      )}

      <div className="relative z-10">
        {/* ═══ WORLD BANNER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 overflow-hidden border border-ink/10 bg-panel/80 backdrop-blur-sm"
          style={{ clipPath: 'polygon(0 0, calc(100% - 32px) 0, 100% 32px, 100% 100%, 0 100%)' }}
        >
          {/* corner accent */}
          <div className="absolute right-0 top-0 z-20">
            <svg width="34" height="34" className="text-gold/40">
              <line x1="2" y1="0" x2="34" y2="32" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>

          <div className="relative">
            {/* map strip */}
            {world?.mapUrl && (
              <div className="absolute inset-0 z-0">
                <img src={world.mapUrl} alt="" className="h-full w-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-gradient-to-r from-panel/95 via-panel/80 to-panel/40" />
                <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" />
              </div>
            )}

            <div className="relative z-10 p-5 sm:p-6">
              {/* top badges */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {world && (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-sm bg-gold/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gold">
                      <Swords className="h-3 w-3" />
                      {world.genre}
                    </span>
                    {world.narrativeStyle && (
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-ember/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-ember">
                        <BookOpen className="h-3 w-3" />
                        {world.narrativeStyle}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-sm bg-ink/8 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                      {world.tone}
                    </span>
                  </>
                )}
              </div>

              {/* title */}
              <h2 className="font-display text-xl font-bold text-ink sm:text-2xl md:text-3xl">
                {world?.title ?? 'Aventura'}
              </h2>

              {/* synopsis */}
              {world?.synopsis && (
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-ink-muted/80 line-clamp-2">
                  {world.synopsis}
                </p>
              )}

              {/* world stats row */}
              {world && (
                <div className="mt-3 flex items-center gap-4 text-[10px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Compass className="h-3 w-3 text-gold/60" />
                    {world.acts?.length ?? 0} atos
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gold/60" />
                    {world.locations?.length ?? 0} locais
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* bottom accent line */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        </motion.div>

        {/* ═══ PARTY HEADER ═══ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-4 flex items-end justify-between px-1"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-gold/10 text-gold"
              style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}
            >
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                Grupo de Aventureiros
              </h3>
              <p className="text-[10px] text-ink-muted">
                {activeCharacters.length} ativo{activeCharacters.length !== 1 ? 's' : ''} de {savedCharacters.length} · máx {MAX_PARTY}
              </p>
            </div>
          </div>

          {charsReady && savedCharacters.length > 0 && (
            <ChoiceButton
              label={canCreate ? 'Novo' : 'Cheio'}
              variant={canCreate ? 'gold' : 'ghost'}
              size="sm"
              icon={<UserPlus />}
              onClick={() => { if (worldId && canCreate) goNewCharacter(worldId) }}
              disabled={!canCreate}
            />
          )}
        </motion.div>

        {/* ═══ CHARACTER CARDS ═══ */}
        {!charsReady ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          </div>
        ) : savedCharacters.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto max-w-md overflow-hidden border border-gold/20 bg-panel/60 p-8 backdrop-blur-sm"
            style={{ clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))' }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold">
                <UserPlus className="h-7 w-7" />
              </div>
              <p className="font-display text-sm font-bold text-ink">Nenhum herói ainda</p>
              <p className="text-xs text-ink-muted">Crie o primeiro personagem para iniciar sua jornada.</p>
              <ChoiceButton
                label="Criar personagem"
                variant="gold"
                size="lg"
                icon={<UserPlus />}
                onClick={() => { if (worldId) goNewCharacter(worldId) }}
                className="mt-2"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`chars-${worldId}`}
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid gap-3 sm:grid-cols-2"
          >
            {savedCharacters.map((character) => {
              const isActive = !character.disabled
              const canEnable = !isActive && activeCharacters.length >= MAX_PARTY
              const isSelected = selectedChar?.id === character.id

              return (
                <motion.div key={character.id} variants={fadeUp}>
                  <div
                    className={`group relative cursor-pointer overflow-hidden border transition-all duration-300 ${
                      isActive
                        ? isSelected
                          ? 'border-gold/50 bg-panel shadow-[0_0_30px_rgba(201,168,76,0.15)]'
                          : 'border-gold/20 bg-panel/80 hover:border-gold/40 hover:shadow-[0_0_20px_rgba(201,168,76,0.08)]'
                        : 'border-ink/10 bg-panel/40 opacity-55'
                    }`}
                    style={{ clipPath: 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))' }}
                    onClick={() => setSelectedChar(isSelected ? null : character)}
                  >
                    {/* corner accents */}
                    <div className="absolute right-0 top-0 z-20">
                      <svg width="20" height="20" className={`transition-colors ${isActive ? 'text-gold/40 group-hover:text-gold/70' : 'text-ink/20'}`}>
                        <line x1="2" y1="0" x2="20" y2="18" stroke="currentColor" strokeWidth="1" />
                      </svg>
                    </div>
                    <div className="absolute bottom-0 left-0 z-20">
                      <svg width="20" height="20" className={`transition-colors ${isActive ? 'text-gold/40 group-hover:text-gold/70' : 'text-ink/20'}`}>
                        <line x1="0" y1="2" x2="18" y2="20" stroke="currentColor" strokeWidth="1" />
                      </svg>
                    </div>

                    {/* top accent line */}
                    {isActive && <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />}

                    <div className="flex">
                      {/* ── PORTRAIT SIDE ── */}
                      <div className="relative hidden w-28 shrink-0 sm:block">
                        {character.portraitUrl ? (
                          <img
                            src={character.portraitUrl}
                            alt={character.name}
                            className={`h-full w-full object-cover object-top transition-all duration-500 ${isActive ? 'group-hover:scale-105' : 'grayscale'}`}
                          />
                        ) : (
                          <div className="flex h-full min-h-[140px] w-full items-center justify-center bg-surface text-3xl font-bold text-ink-muted/30">
                            {character.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-panel/90" />
                        <div className="absolute inset-0 bg-gradient-to-t from-panel/80 via-transparent to-panel/30" />

                        {/* level badge */}
                        <div className="absolute bottom-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-sm border border-gold/30 bg-obsidian/80 text-[10px] font-bold text-gold">
                          {character.level ?? 1}
                        </div>
                      </div>

                      {/* ── INFO SIDE ── */}
                      <div className="relative z-10 flex min-w-0 flex-1 flex-col p-3.5 sm:p-4">
                        {/* mobile portrait + name */}
                        <div className="flex items-center gap-3">
                          <div className="sm:hidden">
                            <CharacterPortrait
                              src={character.portraitUrl}
                              fallback={character.name[0]?.toUpperCase()}
                              size="sm"
                              variant="arch"
                              active={isActive}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`truncate font-display text-sm font-bold ${isActive ? 'text-ink group-hover:text-gold' : 'text-ink-muted line-through'} transition-colors`}>
                                {character.name}
                              </h4>
                              {isActive && <Crown className="h-3 w-3 shrink-0 text-gold/60" />}
                            </div>
                            <p className="text-[10px] uppercase tracking-wider text-ink-muted">
                              {character.archetype}
                              <span className="mx-1.5 text-ink/20">|</span>
                              <span className="sm:hidden">Nv {character.level ?? 1} · </span>
                              {isActive ? 'Ativo' : 'Desativado'}
                            </p>
                          </div>
                        </div>

                        {/* HP + XP bars */}
                        <div className="mt-3 space-y-1.5">
                          <HPBar value={character.hp} max={20} label="HP" icon={<Heart />} color="glow" size="sm" />
                          <HPBar value={character.xp ?? 0} max={(character.level ?? 1) * 100} label="EXP" icon={<Star />} color="gold" size="sm" />
                        </div>

                        {/* stats row */}
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <StatChip icon={<Sword />} value={character.battleAttributes?.ataque ?? character.attack} color="ember" />
                          <StatChip icon={<Shield />} value={character.battleAttributes?.defesa ?? character.defense} color="gold" />
                          <StatChip icon={<Zap />} value={character.battleAttributes?.velocidade ?? 0} color="glow" />
                          <StatChip icon={<Sparkles />} value={character.battleAttributes?.magia ?? 0} color="arcane" />
                        </div>

                        {/* action buttons row */}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={canEnable}
                            onClick={(e) => { e.stopPropagation(); handleToggle(character) }}
                            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all ${
                              isActive
                                ? 'border border-gold/25 bg-gold/10 text-gold hover:bg-gold/20'
                                : 'border border-ink/15 bg-ink/5 text-ink-muted hover:border-gold/20 hover:text-gold disabled:opacity-40'
                            }`}
                            style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}
                          >
                            {isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {isActive ? 'Ativo' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            title="Editar personagem"
                            onClick={(e) => { e.stopPropagation(); handleEdit(character) }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-ink/15 bg-surface/40 text-ink-muted transition-all hover:border-gold/30 hover:text-gold"
                            style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* bottom accent */}
                    {isActive && <div className="absolute inset-x-0 bottom-0 z-10 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* ═══ EXPANDED CHARACTER DETAIL ═══ */}
        <AnimatePresence>
          {selectedChar && (
            <motion.div
              key={selectedChar.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="mt-4 overflow-hidden"
            >
              <div
                className="overflow-hidden border border-gold/25 bg-panel/90 backdrop-blur-sm"
                style={{ clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))' }}
              >
                {/* corners */}
                <div className="absolute right-0 top-0 z-20">
                  <svg width="26" height="26" className="text-gold/50"><line x1="2" y1="0" x2="26" y2="24" stroke="currentColor" strokeWidth="1" /></svg>
                </div>
                <div className="absolute bottom-0 left-0 z-20">
                  <svg width="26" height="26" className="text-gold/50"><line x1="0" y1="2" x2="24" y2="26" stroke="currentColor" strokeWidth="1" /></svg>
                </div>
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

                <div className="flex flex-col sm:flex-row">
                  {/* full portrait */}
                  <div className="relative w-full shrink-0 sm:w-48">
                    {selectedChar.portraitUrl ? (
                      <img src={selectedChar.portraitUrl} alt={selectedChar.name} className="h-56 w-full object-cover object-top sm:h-full" />
                    ) : (
                      <div className="flex h-56 w-full items-center justify-center bg-surface text-5xl font-bold text-ink-muted/30 sm:h-full">
                        {selectedChar.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-panel/80" />
                  </div>

                  {/* detail content */}
                  <div className="relative z-10 flex-1 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-gold">{selectedChar.name}</h3>
                      <span className="rounded-sm bg-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                        Nv {selectedChar.level ?? 1}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-muted">{selectedChar.archetype}</p>

                    {/* action attributes */}
                    <div className="mt-4">
                      <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                        <Compass className="h-3 w-3 text-sky-400" /> Atributos de Ação
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ['Força', selectedChar.actionAttributes?.forca],
                          ['Agilidade', selectedChar.actionAttributes?.agilidade],
                          ['Intelecto', selectedChar.actionAttributes?.intelecto],
                          ['Carisma', selectedChar.actionAttributes?.carisma],
                          ['Vontade', selectedChar.actionAttributes?.vontade],
                          ['Percepção', selectedChar.actionAttributes?.percepcao],
                        ] as [string, number | undefined][]).map(([label, val]) => (
                          <div key={label} className="flex items-center justify-between rounded-sm bg-sky-400/5 px-2.5 py-1.5 text-[10px]">
                            <span className="text-ink-muted">{label}</span>
                            <span className="font-bold text-sky-400">{val ?? 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* battle attributes */}
                    <div className="mt-3">
                      <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                        <Swords className="h-3 w-3 text-ember" /> Atributos de Batalha
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['Velocidade', selectedChar.battleAttributes?.velocidade],
                          ['Ataque', selectedChar.battleAttributes?.ataque],
                          ['Defesa', selectedChar.battleAttributes?.defesa],
                          ['Magia', selectedChar.battleAttributes?.magia],
                        ] as [string, number | undefined][]).map(([label, val]) => (
                          <div key={label} className="flex items-center justify-between rounded-sm bg-ember/5 px-2.5 py-1.5 text-[10px]">
                            <span className="text-ink-muted">{label}</span>
                            <span className="font-bold text-ember">{val ?? 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* advantages / disadvantages */}
                    {((selectedChar.advantages?.length ?? 0) > 0 || (selectedChar.disadvantages?.length ?? 0) > 0) && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedChar.advantages?.map((a) => (
                          <span key={a} className="rounded-sm bg-glow/10 px-2 py-0.5 text-[9px] font-semibold text-glow">+ {a}</span>
                        ))}
                        {selectedChar.disadvantages?.map((d) => (
                          <span key={d} className="rounded-sm bg-ember/10 px-2 py-0.5 text-[9px] font-semibold text-ember">- {d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ ACTIONS ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 flex gap-3"
        >
          <button
            type="button"
            onClick={() => setShowBackConfirm(true)}
            className="h-11 rounded-sm border border-ink/15 bg-panel/60 px-5 text-[10px] font-bold uppercase tracking-wider text-ink-muted transition-all hover:border-ink/30 hover:text-ink"
            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => { if (worldId) goPlay(worldId) }}
            disabled={activeCharacters.length === 0}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-sm border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/5 px-6 text-[10px] font-bold uppercase tracking-wider text-gold transition-all hover:border-gold/50 hover:from-gold/25 hover:to-gold/10 hover:shadow-[0_0_20px_rgba(201,168,76,0.12)] disabled:opacity-30 disabled:hover:border-gold/30 disabled:hover:from-gold/15 disabled:hover:shadow-none"
            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
          >
            <span>Entrar no Mundo</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>

      {/* confirm back */}
      <ConfirmDialog
        open={showBackConfirm}
        title="Voltar ao menu?"
        description="Tem certeza que deseja voltar ao menu principal?"
        confirmLabel="Sim, voltar"
        cancelLabel="Ficar aqui"
        variant="danger"
        onConfirm={() => {
          setShowBackConfirm(false)
          goMenu()
        }}
        onCancel={() => setShowBackConfirm(false)}
      />
    </>
  )
}
