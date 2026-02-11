import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Castle,
  Church,
  CircuitBoard,
  Compass,
  Flame,
  Ghost,
  Globe,
  Lightbulb,
  Mountain,
  Rocket,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Swords,
  TreePine,
  Wand2,
  Waves,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '../components/Badge'
import { ChoiceButton } from '../components/ChoiceButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DiamondDivider } from '../components/DiamondDivider'
import { LoadingCinematic } from '../components/LoadingCinematic'
import { listWorlds } from '../services/cache'
import { createAndCacheWorld } from '../services/worldArchitect'
import { useGameStore } from '../store/useGameStore'
import { useNavigateGame } from '../app/routes'

/* ─── animation helpers ─── */
const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
}
const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
}

/* ─── design helpers ─── */
const clipCard = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'

function CornerAccent({ size = 22, pos }: { size?: number; pos: 'tr' | 'bl' }) {
  return (
    <div className={`absolute z-20 ${pos === 'tr' ? 'right-0 top-0' : 'bottom-0 left-0'}`}>
      <svg width={size} height={size} className="text-gold/40">
        <line
          x1={pos === 'tr' ? 2 : 0} y1={pos === 'tr' ? 0 : 2}
          x2={pos === 'tr' ? size : size - 2} y2={pos === 'tr' ? size - 2 : size}
          stroke="currentColor" strokeWidth="1"
        />
      </svg>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   STEP 1 — Universe / Setting  (16 options)
   ═══════════════════════════════════════════════════════════════ */
type UniverseOption = { id: string; label: string; desc: string; icon: ReactNode }

const universes: UniverseOption[] = [
  { id: 'medieval',       label: 'Medieval Fantasia',        desc: 'Reinos, cavaleiros, dragoes e magia antiga.',                    icon: <Castle className="h-5 w-5" /> },
  { id: 'cyberpunk',      label: 'Futurista / Cyberpunk',    desc: 'Cidades neon, corporacoes e tecnologia avancada.',               icon: <CircuitBoard className="h-5 w-5" /> },
  { id: 'espacial',       label: 'Espacial / Sci-Fi',        desc: 'Viagens interestelares, planetas alienigenas e naves.',          icon: <Rocket className="h-5 w-5" /> },
  { id: 'biblico',        label: 'Biblico / Mitologico',     desc: 'Narrativas inspiradas em textos sagrados e mitologias.',         icon: <Church className="h-5 w-5" /> },
  { id: 'pos-apoc',       label: 'Pos-Apocaliptico',         desc: 'Civilizacao em ruinas, sobrevivencia e mutantes.',               icon: <Skull className="h-5 w-5" /> },
  { id: 'steampunk',      label: 'Steampunk',                desc: 'Tecnologia a vapor, era vitoriana alternativa e engrenagens.',   icon: <Lightbulb className="h-5 w-5" /> },
  { id: 'oriental',       label: 'Oriental / Wuxia',         desc: 'Artes marciais, chi, imperios e filosofia oriental.',            icon: <Flame className="h-5 w-5" /> },
  { id: 'nordico',        label: 'Nordico / Viking',          desc: 'Deuses nordicos, fjords, guerreiros e sagas epicas.',           icon: <Shield className="h-5 w-5" /> },
  { id: 'egipcio',        label: 'Egipcio Antigo',            desc: 'Piramides, faraos, deuses e misterios do deserto.',             icon: <Mountain className="h-5 w-5" /> },
  { id: 'greco-romano',   label: 'Greco-Romano',              desc: 'Olimpo, herois semidivinos e cidades-estado.',                  icon: <Swords className="h-5 w-5" /> },
  { id: 'pirata',         label: 'Pirata / Nautico',          desc: 'Mares, ilhas, tesouros e batalhas navais.',                     icon: <Waves className="h-5 w-5" /> },
  { id: 'western',        label: 'Faroeste / Western',        desc: 'Duelos, fronteira, ouro e fora-da-lei.',                        icon: <Compass className="h-5 w-5" /> },
  { id: 'urbano',         label: 'Urbano Sobrenatural',       desc: 'Cidade moderna com criaturas e segredos ocultos.',              icon: <Ghost className="h-5 w-5" /> },
  { id: 'subterraneo',    label: 'Subterraneo / Hollowworld', desc: 'Civilizacoes abaixo da terra, cavernas e cristais.',            icon: <TreePine className="h-5 w-5" /> },
  { id: 'multiverso',     label: 'Dimensional / Multiverso',  desc: 'Viagens entre dimensoes e realidades paralelas.',               icon: <Globe className="h-5 w-5" /> },
  { id: 'feudal-japones', label: 'Feudal Japones',             desc: 'Samurais, ninjas, shoguns e honra.',                            icon: <ScrollText className="h-5 w-5" /> },
]

/* ═══════════════════════════════════════════════════════════════
   STEP 2 — Narrative style
   ═══════════════════════════════════════════════════════════════ */
type NarrativeOption = { id: string; label: string; desc: string; icon: ReactNode }

const narratives: NarrativeOption[] = [
  { id: 'aventura',      label: 'Aventura',                desc: 'Jornada epica com descobertas, exploracoes e desafios em terras desconhecidas.',  icon: <Compass className="h-5 w-5" /> },
  { id: 'terror',        label: 'Terror / Horror',         desc: 'Atmosfera sombria e tensa. Medo, criaturas e o desconhecido espreitam.',          icon: <Ghost className="h-5 w-5" /> },
  { id: 'misterio',      label: 'Misterio / Investigacao', desc: 'Pistas, enigmas e revelacoes. Desvende segredos com logica e percepcao.',         icon: <Lightbulb className="h-5 w-5" /> },
  { id: 'drama',         label: 'Drama / Romance',         desc: 'Relacionamentos, conflitos emocionais e escolhas morais profundas.',               icon: <BookOpen className="h-5 w-5" /> },
  { id: 'comedia',       label: 'Comedia',                 desc: 'Situacoes engracadas, dialogos leves e absurdos memoraveis.',                      icon: <Sparkles className="h-5 w-5" /> },
  { id: 'intriga',       label: 'Intriga Politica',        desc: 'Conspiracoes, aliancas e traicoes. O poder esta em jogo.',                         icon: <ScrollText className="h-5 w-5" /> },
  { id: 'sobrevivencia', label: 'Sobrevivencia',           desc: 'Recursos escassos, perigos constantes e a luta para se manter vivo.',              icon: <Flame className="h-5 w-5" /> },
  { id: 'guerra',        label: 'Guerra / Militar',        desc: 'Batalhas em larga escala, estrategia, lealdade e sacrificio.',                      icon: <Swords className="h-5 w-5" /> },
  { id: 'epico',         label: 'Epico / Mitologico',      desc: 'Herois lendarios, profecias, artefatos divinos e o destino do mundo.',              icon: <Shield className="h-5 w-5" /> },
]

/* ═══════════════════════════════════════════════════════════════
   STEP 3 — Tone, complexity & custom details
   ═══════════════════════════════════════════════════════════════ */
const tones = [
  { id: 'sombrio',     label: 'Sombrio',     desc: 'Escuro e opressivo.' },
  { id: 'epico',       label: 'Epico',       desc: 'Grandioso e inspirador.' },
  { id: 'leve',        label: 'Leve',        desc: 'Descontraido e acessivel.' },
  { id: 'tenso',       label: 'Tenso',       desc: 'Suspense constante.' },
  { id: 'misterioso',  label: 'Misterioso',  desc: 'Enigmatico e intrigante.' },
  { id: 'melancolico', label: 'Melancolico', desc: 'Nostalgico e reflexivo.' },
]

const complexities = [
  { id: 'curta', label: 'Curta (3 atos)',  desc: 'Aventura rapida e direta.' },
  { id: 'media', label: 'Media (5 atos)',  desc: 'Arco completo com sub-tramas.' },
  { id: 'epica', label: 'Epica (7 atos)',  desc: 'Saga longa e intrincada.' },
]

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
const TOTAL_STEPS = 4

export function TitleScreen() {
  /* store */
  const setPhase = useGameStore((s) => s.setPhase)
  const setWorld = useGameStore((s) => s.setWorld)
  const setSavedWorlds = useGameStore((s) => s.setSavedWorlds)
  const setGenerating = useGameStore((s) => s.setGenerating)
  const setError = useGameStore((s) => s.setError)
  const isGenerating = useGameStore((s) => s.isGenerating)
  const error = useGameStore((s) => s.error)
  const { goCharacters, goMenu } = useNavigateGame()

  /* wizard state */
  const [step, setStep] = useState(1)
  const [selectedUniverse, setSelectedUniverse] = useState<string | null>(null)
  const [selectedNarrative, setSelectedNarrative] = useState<string | null>(null)
  const [selectedTone, setSelectedTone] = useState<string>('epico')
  const [selectedComplexity, setSelectedComplexity] = useState<string>('media')
  const [customDetails, setCustomDetails] = useState('')

  const [showConfirmStart, setShowConfirmStart] = useState(false)
  const [showConfirmBack, setShowConfirmBack] = useState(false)

  /* helpers */
  const universeObj = universes.find((u) => u.id === selectedUniverse)
  const narrativeObj = narratives.find((n) => n.id === selectedNarrative)
  const toneObj = tones.find((t) => t.id === selectedTone)
  const complexityObj = complexities.find((c) => c.id === selectedComplexity)

  const canAdvance = () => {
    if (step === 1) return !!selectedUniverse
    if (step === 2) return !!selectedNarrative
    if (step === 3) return !!selectedTone && !!selectedComplexity
    return true
  }

  const buildPrompt = () => {
    const parts: string[] = []
    if (universeObj) parts.push(`Universo: ${universeObj.label} — ${universeObj.desc}`)
    if (narrativeObj) parts.push(`Estilo narrativo: ${narrativeObj.label} — ${narrativeObj.desc}`)
    if (toneObj) parts.push(`Tom: ${toneObj.label}`)
    if (complexityObj) parts.push(`Complexidade: ${complexityObj.label}`)
    if (customDetails.trim()) parts.push(`Detalhes adicionais: ${customDetails.trim()}`)
    return parts.join('\n')
  }

  const handleGenerate = async () => {
    setShowConfirmStart(false)
    setGenerating(true)
    setError(null)

    try {
      const prompt = buildPrompt()
      const blueprint = await createAndCacheWorld(prompt)
      setWorld(blueprint.world)
      setPhase('ready')
      const worlds = await listWorlds()
      setSavedWorlds(worlds)
      goCharacters(blueprint.world.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar mundo')
    } finally {
      setGenerating(false)
    }
  }

  /* step labels */
  const stepLabels = ['Universo', 'Narrativa', 'Detalhes', 'Revisao']

  /* ─── step indicator ─── */
  const renderStepIndicator = () => (
    <div
      className="relative mb-6 overflow-hidden border border-ink/10 bg-panel/80"
      style={{ clipPath: clipCard }}
    >
      <CornerAccent pos="tr" size={16} />
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      <div className="px-5 py-4 sm:px-6">
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => {
            const s = i + 1
            const active = s === step
            const done = s < step
            return (
              <button
                key={label}
                type="button"
                onClick={() => { if (done) setStep(s) }}
                disabled={!done && !active}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <div className="flex w-full items-center">
                  <div
                    className={`h-1 flex-1 transition-colors duration-300 ${
                      done || active ? 'bg-gold' : 'bg-ink/10'
                    }`}
                    style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 2px) 100%, 2px 100%)' }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold transition-colors ${
                    active ? 'bg-gold text-obsidian' : done ? 'bg-gold/30 text-gold' : 'bg-ink/10 text-ink-muted'
                  }`}>
                    {done ? '✓' : s}
                  </span>
                  <span className={`hidden text-[9px] uppercase tracking-wider transition-colors sm:inline ${
                    active ? 'font-bold text-gold' : done ? 'text-gold/60' : 'text-ink-muted'
                  }`}>
                    {label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  /* ─── option card (reusable) ─── */
  const OptionCard = ({
    selected,
    onClick,
    icon,
    label,
    desc,
    compact,
  }: {
    selected: boolean
    onClick: () => void
    icon?: ReactNode
    label: string
    desc: string
    compact?: boolean
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden border text-left transition-all duration-200 ${
        compact ? 'p-3' : 'p-4'
      } ${
        selected
          ? 'border-gold/30 bg-gold/8 shadow-[0_0_20px_rgba(201,168,76,0.12)]'
          : 'border-ink/10 bg-surface/50 hover:border-gold/15 hover:bg-gold/[0.03]'
      }`}
      style={{ clipPath: clipCard }}
    >
      {selected && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
      )}
      {selected && <CornerAccent pos="tr" size={14} />}
      {icon && (
        <div className={`mb-2 transition-colors ${selected ? 'text-gold' : 'text-ink-muted group-hover:text-ink'}`}>
          {icon}
        </div>
      )}
      <p className={`font-semibold text-ink ${compact ? 'text-[11px]' : 'text-xs'}`}>{label}</p>
      <p className={`mt-1 leading-relaxed text-ink-muted ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{desc}</p>
    </button>
  )

  /* ═══ STEP 1 ═══ */
  const renderStep1 = () => (
    <motion.div key="step1" {...fadeUp} transition={{ duration: 0.35 }}>
      <Badge label="Passo 1" variant="gold" icon={<Globe />} />
      <h2 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl md:text-3xl">
        Escolha o universo
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
        Selecione o cenario que servira de base para seu mundo. Cada opcao define a
        estetica, a tecnologia e as regras do universo.
      </p>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {universes.map((u) => (
          <motion.div key={u.id} variants={fadeUp}>
            <OptionCard
              selected={selectedUniverse === u.id}
              onClick={() => setSelectedUniverse(u.id)}
              icon={u.icon}
              label={u.label}
              desc={u.desc}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )

  /* ═══ STEP 2 ═══ */
  const renderStep2 = () => (
    <motion.div key="step2" {...fadeUp} transition={{ duration: 0.35 }}>
      <Badge label="Passo 2" variant="gold" icon={<BookOpen />} />
      <h2 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl md:text-3xl">
        Estilo de narrativa
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
        Como voce quer que a historia seja contada? Cada estilo altera o clima,
        os tipos de desafio e o ritmo da aventura.
      </p>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {narratives.map((n) => (
          <motion.div key={n.id} variants={fadeUp}>
            <OptionCard
              selected={selectedNarrative === n.id}
              onClick={() => setSelectedNarrative(n.id)}
              icon={n.icon}
              label={n.label}
              desc={n.desc}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )

  /* ═══ STEP 3 ═══ */
  const renderStep3 = () => (
    <motion.div key="step3" {...fadeUp} transition={{ duration: 0.35 }}>
      <Badge label="Passo 3" variant="gold" icon={<Wand2 />} />
      <h2 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">
        Detalhes do mundo
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
        Refine o tom e a escala da aventura. Quanto mais detalhes, mais
        personalizado sera o mundo gerado.
      </p>

      {/* tone */}
      <div className="mt-6">
        <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
          <Flame className="h-3 w-3" /> Tom da narrativa
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {tones.map((t) => (
            <OptionCard
              key={t.id}
              selected={selectedTone === t.id}
              onClick={() => setSelectedTone(t.id)}
              label={t.label}
              desc={t.desc}
              compact
            />
          ))}
        </div>
      </div>

      {/* complexity */}
      <div className="mt-5">
        <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
          <ScrollText className="h-3 w-3" /> Complexidade
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {complexities.map((c) => (
            <OptionCard
              key={c.id}
              selected={selectedComplexity === c.id}
              onClick={() => setSelectedComplexity(c.id)}
              label={c.label}
              desc={c.desc}
              compact
            />
          ))}
        </div>
      </div>

      <DiamondDivider className="my-5" />

      {/* custom text */}
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
          <Wand2 className="h-3 w-3" />
          Detalhes extras (opcional)
        </label>
        <textarea
          className="rpg-input min-h-[80px] resize-y"
          placeholder="Descreva elementos especificos: ruinas antigas, dragao guardiao, uma profecia esquecida..."
          value={customDetails}
          onChange={(e) => setCustomDetails(e.target.value)}
        />
      </div>
    </motion.div>
  )

  /* ═══ STEP 4 — Review ═══ */
  const renderStep4 = () => (
    <motion.div key="step4" {...fadeUp} transition={{ duration: 0.35 }}>
      <Badge label="Passo 4" variant="gold" icon={<Sparkles />} />
      <h2 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">
        Revisao final
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
        Confira suas escolhas. Ao confirmar, a IA gerara o mundo completo com
        mapa, locais, atos, quests e imagens.
      </p>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mt-6 space-y-3"
      >
        <motion.div variants={fadeUp}>
          <div className="relative overflow-hidden border border-gold/20 bg-gold/[0.04] p-4" style={{ clipPath: clipCard }}>
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            <CornerAccent pos="tr" size={14} />
            <p className="text-[10px] uppercase tracking-[0.3em] text-ink-muted">Universo</p>
            <p className="mt-1 font-display text-sm font-semibold text-ink">{universeObj?.label}</p>
            <p className="text-[11px] text-ink-muted">{universeObj?.desc}</p>
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="relative overflow-hidden border border-gold/20 bg-gold/[0.04] p-4" style={{ clipPath: clipCard }}>
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            <CornerAccent pos="tr" size={14} />
            <p className="text-[10px] uppercase tracking-[0.3em] text-ink-muted">Estilo narrativo</p>
            <p className="mt-1 font-display text-sm font-semibold text-ink">{narrativeObj?.label}</p>
            <p className="text-[11px] text-ink-muted">{narrativeObj?.desc}</p>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden border border-ink/10 bg-surface/50 p-4" style={{ clipPath: clipCard }}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-ink-muted">Tom</p>
            <p className="mt-1 text-xs font-semibold text-ink">{toneObj?.label}</p>
          </div>
          <div className="relative overflow-hidden border border-ink/10 bg-surface/50 p-4" style={{ clipPath: clipCard }}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-ink-muted">Complexidade</p>
            <p className="mt-1 text-xs font-semibold text-ink">{complexityObj?.label}</p>
          </div>
        </motion.div>

        {customDetails.trim() && (
          <motion.div variants={fadeUp}>
            <div className="relative overflow-hidden border border-ink/10 bg-surface/50 p-4" style={{ clipPath: clipCard }}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-ink-muted">Detalhes extras</p>
              <p className="mt-1 text-xs text-ink">{customDetails}</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {error && (
        <div className="relative mt-4 overflow-hidden border border-crimson/30 bg-crimson/[0.06] p-4" style={{ clipPath: clipCard }}>
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-crimson/40 to-transparent" />
          <p className="text-xs text-crimson">{error}</p>
        </div>
      )}
    </motion.div>
  )

  /* ═══════════════════════════════════════════════════════════════
     Main return
     ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4">
        {/* ═══ STEP INDICATOR ═══ */}
        {renderStepIndicator()}

        {/* ═══ MAIN CONTENT CARD ═══ */}
        <div
          className="relative overflow-hidden border border-ink/10 bg-panel/80"
          style={{ clipPath: clipCard }}
        >
          <CornerAccent pos="tr" />
          <CornerAccent pos="bl" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold/[0.04] blur-[100px]" />

          <div className="relative p-6 sm:p-8 md:p-10">
            <AnimatePresence mode="wait">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
            </AnimatePresence>

            <div className="my-6 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

            {/* navigation */}
            {isGenerating ? (
              <div className="flex justify-center py-4">
                <LoadingCinematic label="Gerando mundo, mapa e locais..." />
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <ChoiceButton
                  label="Voltar"
                  variant="ghost"
                  icon={<ArrowLeft />}
                  onClick={() => {
                    if (step === 1) setShowConfirmBack(true)
                    else setStep(step - 1)
                  }}
                  className="sm:w-auto"
                />

                {step < TOTAL_STEPS ? (
                  <ChoiceButton
                    label="Proximo"
                    variant="gold"
                    icon={<ArrowRight />}
                    disabled={!canAdvance()}
                    onClick={() => setStep(step + 1)}
                    className="sm:w-auto"
                  />
                ) : (
                  <ChoiceButton
                    label="Gerar mundo"
                    variant="gold"
                    size="lg"
                    icon={<Wand2 />}
                    onClick={() => setShowConfirmStart(true)}
                    className="sm:w-auto"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* confirm generate */}
      <ConfirmDialog
        open={showConfirmStart}
        title="Gerar novo mundo?"
        description={
          `Universo: ${universeObj?.label ?? '—'}\nNarrativa: ${narrativeObj?.label ?? '—'}\nTom: ${toneObj?.label ?? '—'} · ${complexityObj?.label ?? '—'}\n\nA IA criara o mundo completo com mapa, locais e imagens. Continuar?`
        }
        confirmLabel="Gerar"
        cancelLabel="Cancelar"
        onConfirm={handleGenerate}
        onCancel={() => setShowConfirmStart(false)}
      />

      {/* confirm back to menu */}
      <ConfirmDialog
        open={showConfirmBack}
        title="Voltar ao menu?"
        description="Tem certeza que deseja voltar? As selecoes serao perdidas."
        confirmLabel="Sim, voltar"
        cancelLabel="Ficar aqui"
        variant="danger"
        onConfirm={() => {
          setShowConfirmBack(false)
          goMenu()
        }}
        onCancel={() => setShowConfirmBack(false)}
      />
    </>
  )
}
