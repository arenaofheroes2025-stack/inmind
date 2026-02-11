import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Download,
  Map,
  MapPin,
  Play,
  Scroll,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../components/Badge'
import { ChoiceButton } from '../components/ChoiceButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DiamondDivider } from '../components/DiamondDivider'
import { FullscreenCinematic } from '../components/FullscreenCinematic'
import { PageCard } from '../components/PageCard'
import { SectionCard } from '../components/SectionCard'
import { Spinner } from '../components/Spinner'
import type { Location } from '../data/types'
import { getWorld, listLocationsByWorld } from '../services/cache'
import { getOrCreateLocationContent } from '../services/locationArchitect'
import { useGameStore } from '../store/useGameStore'
import { useNavigateGame } from '../app/routes'

const stagger = { animate: { transition: { staggerChildren: 0.05 } } }
const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }

export function BlueprintScreen() {
  const world = useGameStore((state) => state.world)
  const currentWorldId = useGameStore((state) => state.currentWorldId)
  const setWorld = useGameStore((state) => state.setWorld)
  const setPhase = useGameStore((state) => state.setPhase)
  const setCurrentLocationId = useGameStore((state) => state.setCurrentLocationId)
  const currentCharacterId = useGameStore((state) => state.currentCharacterId)
  const { goCharacters, goPlay, goMenu } = useNavigateGame()
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocationId, setLoadingLocationId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [showEnterConfirm, setShowEnterConfirm] = useState(false)
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const [isEntering, setIsEntering] = useState(false)

  const worldId = world?.id ?? currentWorldId

  useEffect(() => {
    if (!worldId) return
    let mounted = true
    const loadWorld = async () => {
      const cachedWorld = await getWorld(worldId)
      if (cachedWorld && mounted) setWorld(cachedWorld)
    }
    loadWorld()
    return () => { mounted = false }
  }, [setWorld, worldId])

  useEffect(() => {
    if (!world) return
    let mounted = true
    const loadLocations = async () => {
      const worldLocations = await listLocationsByWorld(world.id)
      if (mounted) setLocations(worldLocations)
    }
    loadLocations()
    return () => { mounted = false }
  }, [world])

  const acts = useMemo(() => world?.acts ?? [], [world])

  const handlePrepareLocation = async (location: Location) => {
    setLoadingLocationId(location.id)
    setStatusMessage(null)
    try {
      await getOrCreateLocationContent(location, world ?? undefined)
      setStatusMessage(`Conteudo pronto para ${location.name}.`)
    } catch {
      setStatusMessage('Falha ao preparar o local.')
    } finally {
      setLoadingLocationId(null)
    }
  }

  const MIN_CINEMATIC_MS = 6000

  const handleEnterAdventure = async () => {
    setShowEnterConfirm(false)
    const wId = world?.id ?? currentWorldId
    if (!currentCharacterId || !wId) {
      if (wId) goCharacters(wId)
      return
    }
    const firstLocation = locations[0]
    if (!firstLocation) return

    // Show fullscreen cinematic while preparing
    setIsEntering(true)
    const startedAt = Date.now()
    try {
      // Pre-generate location content so player doesn't wait on the adventure screen
      await getOrCreateLocationContent(firstLocation, world ?? undefined)
    } catch {
      // Continue anyway – AdventureScreen will handle fallback
    }
    // Ensure minimum cinematic time
    const elapsed = Date.now() - startedAt
    const remaining = Math.max(0, MIN_CINEMATIC_MS - elapsed)
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
    setCurrentLocationId(firstLocation.id)
    setPhase('playing')
    goPlay(wId, { locationId: firstLocation.id })
  }

  if (!world) {
    return (
      <PageCard className="p-8">
        <p className="text-sm text-ink-muted">Nenhum mundo carregado.</p>
        <div className="mt-4">
          <ChoiceButton label="Voltar" variant="ghost" icon={<ArrowLeft />} onClick={() => goMenu()} className="w-auto" />
        </div>
      </PageCard>
    )
  }

  return (
    <>
      <PageCard className="p-0" ornate>
        {/* header */}
        <div className="border-b border-gold/8 p-6 md:p-8">
          <Badge label="Blueprint" variant="gold" icon={<Map />} />
          <h2 className="mt-3 font-display text-2xl font-bold text-ink">{world.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
            {world.synopsis}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge label={world.genre} />
            <Badge label={world.tone} />
            <Badge label={`${acts.length} atos`} variant="ember" icon={<BookOpen />} />
            <Badge label={`${locations.length} locais`} variant="glow" icon={<MapPin />} />
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* acts */}
            <div>
              <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-ink-muted">
                <Scroll className="h-3 w-3" />
                Arco narrativo
              </p>
              {acts.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum ato definido.</p>
              ) : (
                <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3">
                  {acts.map((act, i) => (
                    <motion.div key={act.id} variants={fadeUp}>
                      <SectionCard glow="gold">
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/8 text-xs font-display font-bold text-gold">
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink">{act.title}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">{act.goal}</p>
                          </div>
                        </div>
                      </SectionCard>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* locations */}
            <div>
              <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-ink-muted">
                <MapPin className="h-3 w-3" />
                Locais
              </p>
              {locations.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum local carregado.</p>
              ) : (
                <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3">
                  {locations.map((location) => (
                    <motion.div key={location.id} variants={fadeUp}>
                      <SectionCard className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <MapPin className="h-3.5 w-3.5 text-glow" />
                            {location.name}
                          </p>
                          <Badge
                            label={`Risco ${location.dangerLevel}`}
                            variant={location.dangerLevel >= 3 ? 'danger' : 'default'}
                            icon={location.dangerLevel >= 3 ? <AlertTriangle /> : undefined}
                          />
                        </div>
                        <p className="text-xs text-ink-muted">Tipo: {location.type}</p>
                        <ChoiceButton
                          label={
                            loadingLocationId === location.id
                              ? 'Preparando...'
                              : 'Preparar local'
                          }
                          size="sm"
                          variant="ghost"
                          icon={<Download />}
                          onClick={() => handlePrepareLocation(location)}
                          disabled={loadingLocationId === location.id}
                        />
                      </SectionCard>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {loadingLocationId ? (
            <div className="mt-6 flex justify-center">
              <Spinner label="Preparando conteudo..." />
            </div>
          ) : null}

          {statusMessage ? (
            <SectionCard className="mt-4" glow="gold">
              <p className="text-xs text-ink">{statusMessage}</p>
            </SectionCard>
          ) : null}

          <DiamondDivider className="my-6" />

          {/* actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ChoiceButton
              label="Voltar ao menu"
              variant="ghost"
              icon={<ArrowLeft />}
              onClick={() => setShowBackConfirm(true)}
              className="sm:w-auto"
            />
            <ChoiceButton
              label={isEntering ? 'Entrando...' : 'Entrar na aventura'}
              variant="gold"
              icon={<Play />}
              onClick={() => setShowEnterConfirm(true)}
              disabled={isEntering}
              className="sm:w-auto"
            />
          </div>
        </div>
      </PageCard>

      {/* confirm enter adventure */}
      <ConfirmDialog
        open={showEnterConfirm}
        title="Iniciar aventura?"
        description={
          currentCharacterId
            ? `Deseja entrar no mundo "${world.title}" e iniciar a aventura?`
            : 'Voce precisa selecionar um personagem antes de iniciar.'
        }
        confirmLabel={currentCharacterId ? 'Entrar' : 'Selecionar personagem'}
        cancelLabel="Cancelar"
        onConfirm={handleEnterAdventure}
        onCancel={() => setShowEnterConfirm(false)}
      />

      {/* confirm back */}
      <ConfirmDialog
        open={showBackConfirm}
        title="Voltar ao menu?"
        description="Tem certeza que deseja voltar ao menu principal?"
        confirmLabel="Sim, voltar"
        cancelLabel="Ficar aqui"
        variant="danger"
        onConfirm={() => { setShowBackConfirm(false); goMenu() }}
        onCancel={() => setShowBackConfirm(false)}
      />

      {/* fullscreen cinematic while entering world */}
      <FullscreenCinematic
        open={isEntering}
        label="Entrando no mundo..."
        sublabel={world ? `Preparando ${locations[0]?.name ?? 'o primeiro local'}` : undefined}
        imageUrl={locations[0]?.imageUrl}
      />
    </>
  )
}
