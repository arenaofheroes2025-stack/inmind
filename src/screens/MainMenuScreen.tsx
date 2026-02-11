import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  Cpu,
  MapPin,
  Plus,
  Scroll,

  Swords,
  Users,
  WifiOff,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { CharacterPortrait } from '../components/CharacterPortrait'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Character } from '../data/types'
import { listCharacters, listWorlds } from '../services/cache'
import { useGameStore } from '../store/useGameStore'
import { useNavigateGame } from '../app/routes'

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
}

const features = [
  {
    title: 'Offline-first',
    desc: 'Mundo salvo no cache. Jogue sem conexao.',
    icon: <WifiOff className="h-5 w-5" />,
    color: 'text-glow',
    border: 'border-glow/15',
  },
  {
    title: 'Narrativa reativa',
    desc: 'Escolhas e dados mudam cada cena.',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'text-gold',
    border: 'border-gold/15',
  },
  {
    title: 'IA generativa',
    desc: 'Mundos, NPCs e retratos criados sob demanda.',
    icon: <Cpu className="h-5 w-5" />,
    color: 'text-ember',
    border: 'border-ember/15',
  },
]

export function MainMenuScreen() {
  const savedWorlds = useGameStore((state) => state.savedWorlds)
  const setSavedWorlds = useGameStore((state) => state.setSavedWorlds)
  const setWorld = useGameStore((state) => state.setWorld)
  const setPhase = useGameStore((state) => state.setPhase)
  const { goCharacters, goNewAdventure } = useNavigateGame()

  const [confirmWorld, setConfirmWorld] = useState<string | null>(null)
  const [charsByWorld, setCharsByWorld] = useState<Record<string, Character[]>>({})
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoadingData(true)
      try {
        // Add small delay to allow UI to render before blocking on IndexedDB
        await new Promise(r => setTimeout(r, 50))
        
        const [worlds, chars] = await Promise.all([listWorlds(), listCharacters()])
        if (!mounted) return
        setSavedWorlds(worlds)
        const grouped: Record<string, Character[]> = {}
        for (const c of chars) {
          if (c.worldId) {
            ;(grouped[c.worldId] ??= []).push(c)
          }
        }
        setCharsByWorld(grouped)
      } finally {
        if (mounted) setIsLoadingData(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [setSavedWorlds])

  const selectedWorld = savedWorlds.find((w) => w.id === confirmWorld)

  const handleContinueWorld = () => {
    if (!selectedWorld) return
    setWorld(selectedWorld)
    setPhase('ready')
    goCharacters(selectedWorld.id)
    setConfirmWorld(null)
  }

  return (
    <>
      {/* ═══ HERO BANNER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative mb-8 overflow-hidden border border-ink/10 bg-panel"
        style={{ clipPath: 'polygon(0 0, calc(100% - 40px) 0, 100% 40px, 100% 100%, 40px 100%, 0 calc(100% - 40px))' }}
      >
        {/* corner accents */}
        <div className="absolute right-0 top-0 z-20">
          <svg width="42" height="42" className="text-gold/50">
            <line x1="2" y1="0" x2="42" y2="40" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 z-20">
          <svg width="42" height="42" className="text-gold/50">
            <line x1="0" y1="2" x2="40" y2="42" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        {/* background banner image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/banner_inmind.jpeg"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian/90 via-obsidian/70 to-obsidian/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-transparent to-obsidian/50" />
        </div>

        {/* top accent line */}
        <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

        <div className="relative z-10 p-6 sm:p-8 md:p-10">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-gold/15 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-gold backdrop-blur-sm">
              <Scroll className="h-3 w-3" />
              RPG Procedural
            </span>

            <h2 className="mt-5 font-display text-2xl font-bold leading-tight text-white drop-shadow-lg sm:text-3xl md:text-4xl">
              Sua jornada<br />
              <span className="gold-shimmer">comeca aqui</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 drop-shadow">
              Crie um universo unico, forje seu heroi e embarque em uma aventura
              com inicio, meio e fim. Tudo gerado por IA, salvo no seu
              dispositivo, pronto para jogar offline.
            </p>
          </motion.div>

          {/* CTA button */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8"
          >
            <button
              type="button"
              onClick={() => goNewAdventure()}
              className="group flex items-center gap-3 border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/5 px-7 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gold transition-all hover:border-gold/50 hover:from-gold/25 hover:to-gold/10 hover:shadow-[0_0_24px_rgba(201,168,76,0.15)]"
              style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}
            >
              <Plus className="h-4 w-4" />
              Nova aventura
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* feature chips */}
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="mt-8 flex flex-wrap gap-3"
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp}>
                <div className={`flex items-center gap-2.5 border bg-obsidian/50 px-4 py-2.5 backdrop-blur-sm ${f.border}`}
                  style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                >
                  <div className={f.color}>{f.icon}</div>
                  <div>
                    <p className="text-[10px] font-bold text-white">{f.title}</p>
                    <p className="text-[9px] leading-snug text-white/50">{f.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* bottom accent line */}
        <div className="absolute inset-x-0 bottom-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </motion.div>

      {/* ══ saved adventures ══ */}
      {isLoadingData && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="h-3 w-3 rounded-full border-2 border-gold/30 border-t-gold animate-spin" style={{ animationDuration: '1s' }} />
            <p className="text-sm text-ink-muted">Carregando aventuras...</p>
          </div>
        </div>
      )}
      {savedWorlds.length > 0 && (
        <div className="mt-8">
          {/* section header */}
          <div className="mb-5 flex items-end justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gold/10 text-gold">
                <Scroll className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                  Aventuras Salvas
                </h3>
                <p className="text-[10px] text-ink-muted">
                  {savedWorlds.length} mundo{savedWorlds.length > 1 ? 's' : ''} disponíve{savedWorlds.length > 1 ? 'is' : 'l'}
                </p>
              </div>
            </div>
          </div>

          {/* adventure cards grid */}
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid gap-4 sm:grid-cols-2"
          >
            {savedWorlds.map((world) => {
              const chars = charsByWorld[world.id] ?? []
              const completedActs = world.acts.filter((a) =>
                (a.missions?.length ?? 0) > 0 && a.missions.every((m) => m.completed),
              ).length
              const totalActs = world.acts.length
              const actProgress = totalActs > 0 ? (completedActs / totalActs) * 100 : 0

              return (
                <motion.div key={world.id} variants={fadeUp}>
                  <div
                    className="group relative cursor-pointer overflow-hidden border border-ink/10 bg-panel transition-all duration-300 hover:border-gold/30 hover:shadow-[0_0_24px_rgba(201,168,76,0.08)]"
                    style={{ clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))' }}
                    onClick={() => setConfirmWorld(world.id)}
                  >
                    {/* ── corner accents ── */}
                    {/* top-right notch */}
                    <div className="absolute right-0 top-0 z-20">
                      <svg width="26" height="26" className="text-gold/30 transition-colors group-hover:text-gold/60">
                        <line x1="2" y1="0" x2="26" y2="24" stroke="currentColor" strokeWidth="1" />
                      </svg>
                    </div>
                    {/* bottom-left notch */}
                    <div className="absolute bottom-0 left-0 z-20">
                      <svg width="26" height="26" className="text-gold/30 transition-colors group-hover:text-gold/60">
                        <line x1="0" y1="2" x2="24" y2="26" stroke="currentColor" strokeWidth="1" />
                      </svg>
                    </div>

                    {/* ── map background ── */}
                    {world.mapUrl && (
                      <div className="absolute inset-0 z-0">
                        <img
                          src={world.mapUrl}
                          alt=""
                          className="h-full w-full object-cover opacity-60 transition-all duration-500 group-hover:scale-105 group-hover:opacity-70"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-panel/90 via-panel/55 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-panel/85 via-panel/25 to-panel/40" />
                      </div>
                    )}

                    {/* ── top edge accent line ── */}
                    <div className="absolute inset-x-0 top-0 z-10 h-[2px]">
                      <div className="h-full w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>

                    {/* ── content ── */}
                    <div className="relative z-10 p-5">
                      {/* header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* genre / style tags */}
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-sm bg-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                              <Swords className="h-2.5 w-2.5" />
                              {world.genre}
                            </span>
                            {world.narrativeStyle && (
                              <span className="inline-flex items-center gap-1 rounded-sm bg-ember/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ember">
                                {world.narrativeStyle}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-sm bg-ink/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                              {world.tone}
                            </span>
                          </div>

                          {/* title */}
                          <h4 className="font-display text-lg font-bold leading-tight text-ink transition-colors group-hover:text-gold sm:text-xl">
                            {world.title}
                          </h4>
                        </div>

                        {/* play indicator */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/5 text-gold/60 transition-all group-hover:border-gold/40 group-hover:bg-gold/15 group-hover:text-gold group-hover:shadow-[0_0_12px_rgba(201,168,76,0.15)]">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>

                      {/* synopsis */}
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted/80">
                        {world.synopsis}
                      </p>

                      {/* ── stats row ── */}
                      <div className="mt-4 flex items-center gap-4 border-t border-ink/8 pt-3">
                        {/* acts progress */}
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-ink/10">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold/60 to-gold transition-all"
                              style={{ width: `${actProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-ink-muted">
                            {completedActs}/{totalActs} atos
                          </span>
                        </div>

                        {/* locations count */}
                        <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                          <MapPin className="h-3 w-3" />
                          {world.locations.length}
                        </div>

                        {/* spacer */}
                        <div className="flex-1" />

                        {/* character avatars */}
                        {chars.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3 w-3 text-ink-muted/60" />
                            <div className="flex -space-x-1.5">
                              {chars.slice(0, 4).map((c) => (
                                <CharacterPortrait
                                  key={c.id}
                                  src={c.portraitUrl}
                                  fallback={c.name[0]?.toUpperCase()}
                                  size="xs"
                                  variant="circle"
                                  className="ring-1 ring-panel"
                                />
                              ))}
                            </div>
                            {chars.length > 4 && (
                              <span className="text-[10px] text-ink-muted">
                                +{chars.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── bottom edge glow ── */}
                    <div className="absolute inset-x-0 bottom-0 z-10 h-[2px]">
                      <div className="h-full w-full bg-gradient-to-r from-transparent via-gold/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      )}

      <ConfirmDialog
        open={confirmWorld !== null}
        title="Continuar aventura?"
        description={
          selectedWorld
            ? `Voce ira retomar o mundo "${selectedWorld.title}". Deseja continuar?`
            : ''
        }
        confirmLabel="Continuar"
        cancelLabel="Voltar"
        onConfirm={handleContinueWorld}
        onCancel={() => setConfirmWorld(null)}
      />
    </>
  )
}
