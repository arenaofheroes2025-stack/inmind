import { motion } from 'framer-motion'
import {
  Axe,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Crosshair,
  Dumbbell,
  Eye,
  Flame,
  Gauge,
  GraduationCap,
  Heart,
  ImagePlus,
  Loader2,
  Moon,
  Paintbrush,
  Palette,
  Ruler,
  Shield,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Sword,
  Swords,
  User,
  UserCircle,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { CharacterPortrait } from '../components/CharacterPortrait'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LoadingCinematic } from '../components/LoadingCinematic'
import { Spinner } from '../components/Spinner'
import { StatBar } from '../components/StatBar'
import type {
  ActionAttributes,
  Appearance,
  BattleAttributes,
  Character,
} from '../data/types'
import { getSaveState, listCharactersByWorld, saveCharacter, saveSaveState, getCharacter } from '../services/cache'
import { createImage } from '../services/imageAiClient'
import { generateCharacterOptions } from '../services/characterArchitect'
import type { CharacterCreationOptions } from '../services/characterArchitect'
import { useGameStore } from '../store/useGameStore'
import { useNavigateGame } from '../app/routes'

/* ── constants ── */
const ACTION_POINTS = 10
const BATTLE_POINTS = 8
const BASE_ATTRIBUTE = 1
const MAX_ATTRIBUTE = 6

const initialActionAttributes: ActionAttributes = {
  forca: BASE_ATTRIBUTE,
  agilidade: BASE_ATTRIBUTE,
  intelecto: BASE_ATTRIBUTE,
  carisma: BASE_ATTRIBUTE,
  vontade: BASE_ATTRIBUTE,
  percepcao: BASE_ATTRIBUTE,
}

const initialBattleAttributes: BattleAttributes = {
  velocidade: BASE_ATTRIBUTE,
  ataque: BASE_ATTRIBUTE,
  defesa: BASE_ATTRIBUTE,
  magia: BASE_ATTRIBUTE,
}

const actionKeys: Array<keyof ActionAttributes> = [
  'forca', 'agilidade', 'intelecto', 'carisma', 'vontade', 'percepcao',
]
const battleKeys: Array<keyof BattleAttributes> = [
  'velocidade', 'ataque', 'defesa', 'magia',
]

const actionLabels: Record<keyof ActionAttributes, string> = {
  forca: 'Forca', agilidade: 'Agilidade', intelecto: 'Intelecto',
  carisma: 'Carisma', vontade: 'Vontade', percepcao: 'Percepcao',
}
const actionIcons: Record<keyof ActionAttributes, ReactNode> = {
  forca: <Dumbbell />, agilidade: <Zap />, intelecto: <Brain />,
  carisma: <Heart />, vontade: <Flame />, percepcao: <Eye />,
}
const actionDescriptions: Record<keyof ActionAttributes, string> = {
  forca: 'Poder fisico bruto. Arrombamento, escalada, combate corpo-a-corpo.',
  agilidade: 'Reflexos e velocidade. Esquiva, furtividade, acrobacias.',
  intelecto: 'Raciocinio e saber. Pesquisa, deducao, mecanismos.',
  carisma: 'Presenca e persuasao. Negociacao, inspiracao, enganacao.',
  vontade: 'Disciplina mental. Resistencia a medo, foco, magia de controle.',
  percepcao: 'Sentidos aguçados. Detectar armadilhas, ler situacoes, rastrear.',
}

const battleLabels: Record<keyof BattleAttributes, string> = {
  velocidade: 'Velocidade', ataque: 'Ataque', defesa: 'Defesa', magia: 'Magia',
}
const battleIcons: Record<keyof BattleAttributes, ReactNode> = {
  velocidade: <Gauge />, ataque: <Crosshair />, defesa: <ShieldCheck />, magia: <Sparkles />,
}
const battleDescriptions: Record<keyof BattleAttributes, string> = {
  velocidade: 'Determina iniciativa e ordem de turno.',
  ataque: 'Dano fisico base em combate.',
  defesa: 'Reducao de dano sofrido.',
  magia: 'Poder de efeitos especiais e magicos.',
}

const archetypes: { id: string; icon: ReactNode; desc: string }[] = [
  { id: 'Guerreiro', icon: <Sword className="h-6 w-6" />, desc: 'Forca e combate direto' },
  { id: 'Explorador', icon: <Compass className="h-6 w-6" />, desc: 'Agilidade e descoberta' },
  { id: 'Diplomata', icon: <Crown className="h-6 w-6" />, desc: 'Carisma e estrategia social' },
  { id: 'Tecnico', icon: <Wrench className="h-6 w-6" />, desc: 'Intelecto e criatividade' },
  { id: 'Mago', icon: <Sparkles className="h-6 w-6" />, desc: 'Magia e conhecimento arcano' },
  { id: 'Ladino', icon: <Moon className="h-6 w-6" />, desc: 'Furtividade e golpes precisos' },
  { id: 'Clerigo', icon: <BookOpen className="h-6 w-6" />, desc: 'Cura e poderes divinos' },
  { id: 'Barbaro', icon: <Axe className="h-6 w-6" />, desc: 'Furia e resistencia bruta' },
]

const appearanceLabels: Record<keyof Appearance, string> = {
  genero: 'Genero', raca: 'Raca / Especie', idade: 'Idade',
  pele: 'Pele', cabelo: 'Estilo de cabelo', corCabelo: 'Cor do cabelo',
  olhos: 'Olhos', altura: 'Altura / Corpo', traje: 'Traje',
  acessorio: 'Acessorio', detalhe: 'Detalhe marcante',
}
const appearanceIcons: Record<keyof Appearance, ReactNode> = {
  genero: <UserCircle className="h-4 w-4" />,
  raca: <GraduationCap className="h-4 w-4" />,
  idade: <User className="h-4 w-4" />,
  pele: <Palette className="h-4 w-4" />,
  cabelo: <Wind className="h-4 w-4" />,
  corCabelo: <Palette className="h-4 w-4" />,
  olhos: <Eye className="h-4 w-4" />,
  altura: <Ruler className="h-4 w-4" />,
  traje: <Shirt className="h-4 w-4" />,
  acessorio: <Star className="h-4 w-4" />,
  detalhe: <Sparkles className="h-4 w-4" />,
}

/* ── selectable preset options for each appearance field ── */
const appearancePresets: Partial<Record<keyof Appearance, string[]>> = {
  genero: ['Masculino', 'Feminino'],
  raca: ['Humano', 'Elfo', 'Meio-Elfo', 'Anao', 'Orc', 'Meio-Orc', 'Tiefling', 'Draconato', 'Gnomo', 'Halfling', 'Kitsune', 'Feerico'],
  idade: ['Jovem (16-20)', 'Adulto (21-35)', 'Maduro (36-50)', 'Idoso (50+)', 'Imortal'],
  pele: ['Clara', 'Morena', 'Negra', 'Oliva', 'Palida', 'Azulada', 'Esverdeada', 'Dourada', 'Avermelhada'],
  cabelo: ['Curto', 'Medio', 'Longo', 'Muito longo', 'Moicano', 'Rabo de cavalo', 'Trancas', 'Careca', 'Ondulado', 'Cacheado', 'Espetado'],
  corCabelo: ['Preto', 'Castanho', 'Loiro', 'Ruivo', 'Branco', 'Prateado', 'Azul', 'Rosa', 'Roxo', 'Verde', 'Vermelho fogo', 'Bicolor'],
  olhos: ['Castanhos', 'Azuis', 'Verdes', 'Dourados', 'Vermelhos', 'Violeta', 'Prata', 'Heterocromia', 'Brilhantes', 'Rasgados'],
  altura: ['Baixo e compacto', 'Medio e agil', 'Alto e esguio', 'Alto e musculoso', 'Pequeno (halfling)', 'Imponente e largo'],
  traje: ['Armadura pesada', 'Armadura leve de couro', 'Manto de mago', 'Roupa de viajante', 'Traje nobre', 'Roupa ninja/assassino', 'Vestes de clerigo', 'Traje tribal/barbaro', 'Uniforme militar', 'Vestido elegante'],
  acessorio: ['Nenhum', 'Capa longa', 'Capuz', 'Tiara/Coroa', 'Brincos', 'Colar magico', 'Tapa-olho', 'Luvas de combate', 'Cinto de pocoes', 'Mascara'],
  detalhe: ['Nenhum', 'Cicatriz no rosto', 'Tatuagem tribal', 'Marcas arcanas brilhantes', 'Chifres pequenos', 'Orelhas pontudas', 'Olho magico/brilhante', 'Aura misteriosa', 'Asas vestigiais', 'Cauda fina'],
}

/* ── steps ── */
type Step = 'identity' | 'action-stats' | 'battle-stats' | 'appearance' | 'review'
const steps: { key: Step; label: string; icon: ReactNode }[] = [
  { key: 'identity', label: 'Identidade', icon: <User className="h-4 w-4" /> },
  { key: 'action-stats', label: 'Acao', icon: <Zap className="h-4 w-4" /> },
  { key: 'battle-stats', label: 'Batalha', icon: <Swords className="h-4 w-4" /> },
  { key: 'appearance', label: 'Visual', icon: <Paintbrush className="h-4 w-4" /> },
  { key: 'review', label: 'Revisao', icon: <CheckCircle2 className="h-4 w-4" /> },
]

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
}

/* ── icon pool for AI-generated archetypes ── */
const ARCHETYPE_ICON_POOL: ReactNode[] = [
  <Sword className="h-6 w-6" />,
  <Compass className="h-6 w-6" />,
  <Crown className="h-6 w-6" />,
  <Wrench className="h-6 w-6" />,
  <Sparkles className="h-6 w-6" />,
  <Moon className="h-6 w-6" />,
  <BookOpen className="h-6 w-6" />,
  <Axe className="h-6 w-6" />,
  <Shield className="h-6 w-6" />,
  <Flame className="h-6 w-6" />,
  <Star className="h-6 w-6" />,
  <Eye className="h-6 w-6" />,
]

export function CharacterCreateScreen() {
  const setSavedCharacters = useGameStore((state) => state.setSavedCharacters)
  const setCurrentCharacterId = useGameStore((state) => state.setCurrentCharacterId)
  const editingCharacterId = useGameStore((state) => state.editingCharacterId)
  const setEditingCharacterId = useGameStore((state) => state.setEditingCharacterId)
  const world = useGameStore((state) => state.world)
  const currentWorldId = useGameStore((state) => state.currentWorldId)
  const worldId = world?.id ?? currentWorldId
  const { goCharacters } = useNavigateGame()

  const contentRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('identity')
  const [charId, setCharId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [archetype, setArchetype] = useState(archetypes[0].id)
  const [actionAttributes, setActionAttributes] = useState<ActionAttributes>(initialActionAttributes)
  const [battleAttributes, setBattleAttributes] = useState<BattleAttributes>(initialBattleAttributes)
  const [advantages, setAdvantages] = useState('')
  const [disadvantages, setDisadvantages] = useState('')
  const [attack, setAttack] = useState(3)
  const [defense, setDefense] = useState(2)
  const [portraitUrl, setPortraitUrl] = useState<string | undefined>(undefined)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [loaded, setLoaded] = useState(false)

  /* ── AI-generated character options ── */
  const [aiOptions, setAiOptions] = useState<CharacterCreationOptions | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  const [appearance, setAppearance] = useState<Appearance>({
    genero: 'Masculino', raca: 'Humano', idade: 'Adulto (21-35)',
    pele: 'Morena', cabelo: 'Medio', corCabelo: 'Castanho',
    olhos: 'Castanhos', altura: 'Medio e agil', traje: 'Roupa de viajante',
    acessorio: 'Capa longa', detalhe: 'Cicatriz no rosto',
  })

  /* ── load character for editing ── */
  useEffect(() => {
    if (!editingCharacterId || loaded) return
    let m = true
    getCharacter(editingCharacterId).then((c) => {
      if (!c || !m) return
      setCharId(c.id)
      setName(c.name)
      setArchetype(c.archetype)
      setActionAttributes(c.actionAttributes)
      setBattleAttributes(c.battleAttributes)
      setAdvantages(c.advantages.join(', '))
      setDisadvantages(c.disadvantages.join(', '))
      setAttack(c.attack)
      setDefense(c.defense)
      setPortraitUrl(c.portraitUrl)
      if (c.appearance) setAppearance(c.appearance)
      setLoaded(true)
    })
    return () => { m = false }
  }, [editingCharacterId, loaded])

  /* ── auto-load AI options on mount ── */
  useEffect(() => {
    if (!world) return
    let m = true
    setLoadingOptions(true)
    setOptionsError(null)
    generateCharacterOptions(world)
      .then((opts) => {
        if (!m) return
        setAiOptions(opts)
        // default archetype to first AI option when not editing
        if (!editingCharacterId && opts.archetypes.length > 0) {
          setArchetype(opts.archetypes[0].id)
          // Set appearance defaults from AI presets
          const p = opts.appearancePresets
          setAppearance({
            genero: p.genero?.[0] ?? 'Masculino',
            raca: p.raca?.[0] ?? 'Humano',
            idade: p.idade?.[0] ?? 'Adulto (21-35)',
            pele: p.pele?.[0] ?? 'Morena',
            cabelo: p.cabelo?.[0] ?? 'Medio',
            corCabelo: p.corCabelo?.[0] ?? 'Castanho',
            olhos: p.olhos?.[0] ?? 'Castanhos',
            altura: p.altura?.[0] ?? 'Medio e agil',
            traje: p.traje?.[0] ?? 'Roupa de viajante',
            acessorio: p.acessorio?.[0] ?? 'Capa longa',
            detalhe: p.detalhe?.[0] ?? 'Cicatriz no rosto',
          })
        }
      })
      .catch((err) => {
        if (m) setOptionsError(err instanceof Error ? err.message : 'Falha ao gerar opcoes')
      })
      .finally(() => { if (m) setLoadingOptions(false) })
    return () => { m = false }
  }, [world, editingCharacterId])

  /* ── derive active options (AI or fallback) ── */
  const activeArchetypes = useMemo(() => {
    if (!aiOptions) return archetypes
    return aiOptions.archetypes.map((a, i) => ({
      id: a.id,
      icon: ARCHETYPE_ICON_POOL[i % ARCHETYPE_ICON_POOL.length],
      desc: a.desc,
    }))
  }, [aiOptions])

  const activeAppearancePresets = useMemo((): Partial<Record<keyof Appearance, string[]>> => {
    if (!aiOptions) return appearancePresets
    return aiOptions.appearancePresets
  }, [aiOptions])

  /* ── scroll to content when step changes (mobile optimization) ── */
  useEffect(() => {
    if (!contentRef.current) return
    // Scroll to the content container with smooth behavior
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }, [step])

  /* ── derived ── */
  const actionPointsUsed = actionKeys.reduce((s, k) => s + actionAttributes[k], 0) - BASE_ATTRIBUTE * actionKeys.length
  const battlePointsUsed = battleKeys.reduce((s, k) => s + battleAttributes[k], 0) - BASE_ATTRIBUTE * battleKeys.length
  const actionPointsRemaining = ACTION_POINTS - actionPointsUsed
  const battlePointsRemaining = BATTLE_POINTS - battlePointsUsed

  const appearancePrompt = useMemo(() =>
    `Personagem de RPG fantasia em estilo anime 2D de alta qualidade. Retrato de corpo inteiro, proporcao 9:16. ` +
    `Raca: ${appearance.raca}. Genero: ${appearance.genero}. Idade: ${appearance.idade}. ` +
    `Pele ${appearance.pele}, cabelo ${appearance.cabelo} na cor ${appearance.corCabelo}, ` +
    `olhos ${appearance.olhos}. Corpo: ${appearance.altura}. ` +
    `Vestindo ${appearance.traje}. Acessorio: ${appearance.acessorio}. ` +
    `Detalhe marcante: ${appearance.detalhe}. ` +
    `Classe: ${archetype}. ` +
    `Fundo com gradiente escuro suave (sem fundo preto solido), estilo concept art de RPG coreano/japones, ` +
    `iluminacao cinematica, sombras suaves, cores vibrantes, qualidade de gacha game premium.`,
    [appearance, archetype],
  )

  const canSave = name.trim().length > 1 && actionPointsRemaining >= 0 && battlePointsRemaining >= 0

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  /* ── handlers ── */
  const updateActionAttribute = (key: keyof ActionAttributes, delta: number) => {
    setActionAttributes((prev) => ({
      ...prev,
      [key]: Math.min(MAX_ATTRIBUTE, Math.max(BASE_ATTRIBUTE, prev[key] + delta)),
    }))
  }
  const updateBattleAttribute = (key: keyof BattleAttributes, delta: number) => {
    setBattleAttributes((prev) => ({
      ...prev,
      [key]: Math.min(MAX_ATTRIBUTE, Math.max(BASE_ATTRIBUTE, prev[key] + delta)),
    }))
  }

  const handleGeneratePortrait = async () => {
    setIsGenerating(true)
    try {
      const response = await createImage(appearancePrompt)
      const url = response.data?.[0]?.url
      if (url) setPortraitUrl(url)
    } catch {
      /* silent */
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    setShowSaveConfirm(false)
    if (!canSave) return
    const id = charId ?? crypto?.randomUUID?.() ?? `char-${Date.now()}`
    const character: Character = {
      id,
      worldId: worldId ?? undefined,
      name: name.trim(),
      archetype,
      actionAttributes,
      battleAttributes,
      advantages: advantages.split(',').map((i) => i.trim()).filter(Boolean),
      disadvantages: disadvantages.split(',').map((i) => i.trim()).filter(Boolean),
      attack, defense, skills: [], inventory: [], hp: 20, xp: 0, level: 1, status: [],
      gold: 0,
      equippedItems: { arma: null, armadura: null, escudo: null, acessorio: null },
      portraitUrl, appearance,
      battleSkills: [],
    }
    await saveCharacter(character)
    if (worldId) {
      const updated = await listCharactersByWorld(worldId)
      setSavedCharacters(updated)
    }
    setCurrentCharacterId(character.id)
    setEditingCharacterId(null)

    if (worldId) {
      const saveId = `save-${worldId}`
      const cached = await getSaveState(saveId)
      const nextState = cached
        ? { ...cached, characterId: character.id, updatedAt: new Date().toISOString() }
        : { id: saveId, worldId, characterId: character.id, currentLocationId: '', activeQuestIds: [], currentActId: '', completedActIds: [], completedMissionIds: [], visitedLocationIds: [], phase: 'ready' as const, updatedAt: new Date().toISOString() }
      await saveSaveState(nextState)
    }
    if (worldId) goCharacters(worldId)
  }

  const goNext = () => {
    const idx = currentStepIndex
    if (idx < steps.length - 1) setStep(steps[idx + 1].key)
  }
  const goPrev = () => {
    const idx = currentStepIndex
    if (idx > 0) setStep(steps[idx - 1].key)
  }

  /* ── helpers ── */
  const clipCard = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
  const clipSmall = 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
  const clipBtn = 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'

  const CornerAccent = ({ size = 22, pos }: { size?: number; pos: 'tr' | 'bl' }) => (
    <div className={`absolute z-20 ${pos === 'tr' ? 'right-0 top-0' : 'bottom-0 left-0'}`}>
      <svg width={size} height={size} className="text-gold/40">
        <line x1={pos === 'tr' ? 2 : 0} y1={pos === 'tr' ? 0 : 2} x2={pos === 'tr' ? size : size - 2} y2={pos === 'tr' ? size - 2 : size} stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  )

  /* ── render ── */
  return (
    <>
      {/* ── Loading cinematic while AI generates options ── */}
      {loadingOptions && !aiOptions ? (
        <div
          className="flex items-center justify-center border border-gold/15 bg-panel/80 py-16 backdrop-blur-sm"
          style={{ clipPath: clipCard }}
        >
          <LoadingCinematic label="Gerando opcoes de criacao para sua aventura..." />
        </div>
      ) : (
      <div className="space-y-4">
        {/* ═══ STEP INDICATOR ═══ */}
        <div
          className="relative overflow-hidden border border-ink/10 bg-panel/80"
          style={{ clipPath: clipCard }}
        >
          <CornerAccent pos="tr" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

          <div className="px-5 py-4 sm:px-6">
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <div
                  key={s.key}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex w-full items-center">
                    <div
                      className={`h-1 flex-1 transition-colors duration-300 ${
                        i <= currentStepIndex ? 'bg-gold' : 'bg-ink/10'
                      }`}
                      style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 2px) 100%, 2px 100%)' }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5 ${
                        s.key === step ? 'text-gold' : i < currentStepIndex ? 'text-gold/40' : 'text-ink-muted'
                      }`}
                    >
                      {s.icon}
                    </span>
                    <span
                      className={`hidden text-[9px] uppercase tracking-wider transition-colors sm:inline ${
                        s.key === step ? 'text-gold font-bold' : 'text-ink-muted'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ MAIN CONTENT CARD ═══ */}
        <div
          ref={contentRef}
          className="relative overflow-hidden border border-ink/10 bg-panel/80"
          style={{ clipPath: clipCard }}
        >
          <CornerAccent pos="tr" />
          <CornerAccent pos="bl" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

          <div className="p-5 sm:p-6 md:p-8">
            {/* ── STEP: Identity ── */}
            {step === 'identity' ? (
              <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-gold/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gold">
                    <User className="h-3 w-3" /> Passo 1
                  </span>
                  <h2 className="mt-3 font-display text-xl font-bold text-ink">Identidade do herói</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    Escolha nome, classe e traços especiais.
                  </p>
                </div>

                <div className="space-y-5">
                  {/* name input */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                      <User className="h-3 w-3" /> Nome do personagem
                    </label>
                    <input
                      className="rpg-input"
                      placeholder="Ex: Aelara, Kael, Vynn..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {/* archetype grid */}
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                      <Shield className="h-3 w-3" /> Classe
                      {loadingOptions && (
                        <span className="ml-auto flex items-center gap-1.5 text-[9px] text-gold">
                          <Loader2 className="h-3 w-3 animate-spin" /> Gerando...
                        </span>
                      )}
                    </label>
                    {optionsError && (
                      <p className="mb-2 text-[10px] text-ember">{optionsError} — usando opcoes padrao.</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {activeArchetypes.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setArchetype(a.id)}
                          className={`group relative overflow-hidden border p-3 text-left transition-all duration-200 ${
                            archetype === a.id
                              ? 'border-gold/40 bg-gold/10 shadow-[0_0_16px_rgba(201,168,76,0.12)]'
                              : 'border-ink/10 bg-surface/40 hover:border-gold/20 hover:bg-gold/[0.03]'
                          }`}
                          style={{ clipPath: clipSmall }}
                        >
                          {archetype === a.id && (
                            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                          )}
                          <div className={`mb-1 transition-colors [&>svg]:h-5 [&>svg]:w-5 ${archetype === a.id ? 'text-gold' : 'text-ink-muted group-hover:text-ink'}`}>
                            {a.icon}
                          </div>
                          <p className={`text-[11px] font-semibold ${archetype === a.id ? 'text-gold' : 'text-ink'}`}>{a.id}</p>
                          <p className="text-[9px] leading-snug text-ink-muted">{a.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* advantages / disadvantages */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                        <Sparkles className="h-3 w-3 text-glow" /> Vantagens (virgula)
                      </label>
                      <input
                        className="rpg-input"
                        placeholder="Visao noturna, Sorte..."
                        value={advantages}
                        onChange={(e) => setAdvantages(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                        <Shield className="h-3 w-3 text-ember" /> Desvantagens (virgula)
                      </label>
                      <input
                        className="rpg-input"
                        placeholder="Impulsivo, Medo do escuro..."
                        value={disadvantages}
                        onChange={(e) => setDisadvantages(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* ── STEP: Action Stats ── */}
            {step === 'action-stats' ? (
              <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-sky-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                    <Zap className="h-3 w-3" /> Passo 2
                  </span>
                  <h2 className="mt-3 font-display text-xl font-bold text-ink">Atributos de ação</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    Usados em escolhas narrativas. Distribua {ACTION_POINTS} pontos.
                  </p>
                </div>

                {/* points remaining card */}
                <div
                  className="flex items-center justify-between border border-sky-400/20 bg-sky-400/5 px-4 py-3"
                  style={{ clipPath: clipSmall }}
                >
                  <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" /> Pontos restantes
                  </p>
                  <span className={`rounded-sm px-2.5 py-0.5 text-xs font-bold ${
                    actionPointsRemaining > 0 ? 'bg-sky-400/15 text-sky-400'
                      : actionPointsRemaining === 0 ? 'bg-ink/10 text-ink-muted'
                        : 'bg-ember/15 text-ember'
                  }`}>
                    {actionPointsRemaining}
                  </span>
                </div>

                <div className="space-y-4">
                  {actionKeys.map((key) => (
                    <StatBar
                      key={key}
                      label={actionLabels[key]}
                      icon={actionIcons[key]}
                      value={actionAttributes[key]}
                      max={MAX_ATTRIBUTE}
                      color="glow"
                      description={actionDescriptions[key]}
                      onDecrement={() => updateActionAttribute(key, -1)}
                      onIncrement={() => updateActionAttribute(key, 1)}
                      disableDecrement={actionAttributes[key] <= BASE_ATTRIBUTE}
                      disableIncrement={actionAttributes[key] >= MAX_ATTRIBUTE || actionPointsRemaining <= 0}
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}

            {/* ── STEP: Battle Stats ── */}
            {step === 'battle-stats' ? (
              <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-ember/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-ember">
                    <Swords className="h-3 w-3" /> Passo 3
                  </span>
                  <h2 className="mt-3 font-display text-xl font-bold text-ink">Atributos de batalha</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    Usados em combate. Distribua {BATTLE_POINTS} pontos.
                  </p>
                </div>

                {/* points remaining card */}
                <div
                  className="flex items-center justify-between border border-ember/20 bg-ember/5 px-4 py-3"
                  style={{ clipPath: clipSmall }}
                >
                  <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Flame className="h-3.5 w-3.5 text-ember" /> Pontos restantes
                  </p>
                  <span className={`rounded-sm px-2.5 py-0.5 text-xs font-bold ${
                    battlePointsRemaining > 0 ? 'bg-ember/15 text-ember'
                      : battlePointsRemaining === 0 ? 'bg-ink/10 text-ink-muted'
                        : 'bg-ember/15 text-ember'
                  }`}>
                    {battlePointsRemaining}
                  </span>
                </div>

                <div className="space-y-4">
                  {battleKeys.map((key) => (
                    <StatBar
                      key={key}
                      label={battleLabels[key]}
                      icon={battleIcons[key]}
                      value={battleAttributes[key]}
                      max={MAX_ATTRIBUTE}
                      color="ember"
                      description={battleDescriptions[key]}
                      onDecrement={() => updateBattleAttribute(key, -1)}
                      onIncrement={() => updateBattleAttribute(key, 1)}
                      disableDecrement={battleAttributes[key] <= BASE_ATTRIBUTE}
                      disableIncrement={battleAttributes[key] >= MAX_ATTRIBUTE || battlePointsRemaining <= 0}
                    />
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                      <Sword className="h-3 w-3 text-ember" /> Ataque base
                    </label>
                    <input
                      type="number"
                      className="rpg-input"
                      value={attack}
                      onChange={(e) => setAttack(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                      <Shield className="h-3 w-3 text-gold" /> Defesa base
                    </label>
                    <input
                      type="number"
                      className="rpg-input"
                      value={defense}
                      onChange={(e) => setDefense(Number(e.target.value))}
                    />
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* ── STEP: Appearance ── */}
            {step === 'appearance' ? (
              <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-arcane/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-arcane">
                    <Paintbrush className="h-3 w-3" /> Passo 4
                  </span>
                  <h2 className="mt-3 font-display text-xl font-bold text-ink">Aparência</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    Descreva o visual e gere um retrato em estilo anime.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* appearance fields */}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {(Object.keys(appearance) as Array<keyof Appearance>).map((key) => {
                      const presets = activeAppearancePresets[key]
                      return (
                        <div key={key}>
                          <label className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                            {appearanceIcons[key]}
                            {appearanceLabels[key]}
                          </label>
                          {presets ? (
                            <div className="flex flex-wrap gap-1.5">
                              {presets.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setAppearance((prev) => ({ ...prev, [key]: preset }))}
                                  className={`border px-2.5 py-1.5 text-[11px] transition-all ${
                                    appearance[key] === preset
                                      ? 'border-gold/30 bg-gold/10 text-gold font-semibold'
                                      : 'border-ink/10 bg-surface/40 text-ink-muted hover:border-gold/15 hover:text-ink'
                                  }`}
                                  style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input
                              className="rpg-input"
                              value={appearance[key]}
                              onChange={(e) => setAppearance((prev) => ({ ...prev, [key]: e.target.value }))}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* portrait side */}
                  <div className="space-y-4">
                    {/* prompt preview */}
                    <div
                      className="border border-gold/20 bg-gold/5 p-4"
                      style={{ clipPath: clipSmall }}
                    >
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold">
                        <Sparkles className="h-3 w-3" /> Prompt gerado
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-ink">
                        {appearancePrompt}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGeneratePortrait}
                      disabled={isGenerating}
                      className="flex w-full items-center justify-center gap-2 border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/5 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gold transition-all hover:border-gold/50 hover:from-gold/25 hover:shadow-[0_0_16px_rgba(201,168,76,0.1)] disabled:opacity-40"
                      style={{ clipPath: clipBtn }}
                    >
                      <ImagePlus className="h-4 w-4" />
                      {isGenerating ? 'Gerando retrato...' : 'Gerar retrato (9:16)'}
                    </button>

                    {isGenerating ? (
                      <div className="flex justify-center py-8">
                        <Spinner label="Gerando imagem..." />
                      </div>
                    ) : null}

                    {portraitUrl && !isGenerating ? (
                      <div
                        className="overflow-hidden border border-gold/20 shadow-[0_0_30px_rgba(201,168,76,0.1)]"
                        style={{ clipPath: clipCard }}
                      >
                        <img
                          src={portraitUrl}
                          alt="Retrato do personagem"
                          className="aspect-[9/16] w-full object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* ── STEP: Review ── */}
            {step === 'review' ? (
              <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="space-y-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-gold/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gold">
                    <CheckCircle2 className="h-3 w-3" /> Passo 5
                  </span>
                  <h2 className="mt-3 font-display text-xl font-bold text-ink">Revisão</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    Confirme os dados antes de salvar.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-[1fr_200px]">
                  <div className="space-y-4">
                    {/* character identity card */}
                    <div
                      className="border border-gold/20 bg-gold/5 p-4"
                      style={{ clipPath: clipSmall }}
                    >
                      <div className="flex items-center gap-4">
                        <CharacterPortrait
                          src={portraitUrl}
                          fallback={(name || '?')[0]}
                          variant="circle"
                          size="md"
                          active
                        />
                        <div>
                          <h3 className="font-display text-base font-bold text-ink">
                            {name || 'Sem nome'}
                          </h3>
                          <p className="text-[10px] uppercase tracking-wider text-gold">{archetype}</p>
                        </div>
                      </div>
                      {(advantages || disadvantages) && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {advantages.split(',').filter(Boolean).map((a) => (
                            <span key={a} className="rounded-sm bg-glow/10 px-2 py-0.5 text-[9px] font-semibold text-glow">+ {a.trim()}</span>
                          ))}
                          {disadvantages.split(',').filter(Boolean).map((d) => (
                            <span key={d} className="rounded-sm bg-ember/10 px-2 py-0.5 text-[9px] font-semibold text-ember">- {d.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* stats panels */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* action stats */}
                      <div
                        className="border border-sky-400/20 bg-sky-400/5 p-4"
                        style={{ clipPath: clipSmall }}
                      >
                        <p className="mb-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                          <Zap className="h-3 w-3" /> Ação
                        </p>
                        <div className="space-y-1">
                          {actionKeys.map((k) => (
                            <div key={k} className="flex items-center justify-between py-1">
                              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                                <span className="text-sky-400 [&>svg]:h-3 [&>svg]:w-3">{actionIcons[k]}</span>
                                {actionLabels[k]}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-12 overflow-hidden rounded-full bg-ink/10">
                                  <div className="h-full bg-sky-400/60 transition-all" style={{ width: `${(actionAttributes[k] / MAX_ATTRIBUTE) * 100}%` }} />
                                </div>
                                <span className="w-4 text-right text-xs font-bold text-ink">{actionAttributes[k]}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* battle stats */}
                      <div
                        className="border border-ember/20 bg-ember/5 p-4"
                        style={{ clipPath: clipSmall }}
                      >
                        <p className="mb-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-ember">
                          <Swords className="h-3 w-3" /> Batalha
                        </p>
                        <div className="space-y-1">
                          {battleKeys.map((k) => (
                            <div key={k} className="flex items-center justify-between py-1">
                              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                                <span className="text-ember [&>svg]:h-3 [&>svg]:w-3">{battleIcons[k]}</span>
                                {battleLabels[k]}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-12 overflow-hidden rounded-full bg-ink/10">
                                  <div className="h-full bg-ember/60 transition-all" style={{ width: `${(battleAttributes[k] / MAX_ATTRIBUTE) * 100}%` }} />
                                </div>
                                <span className="w-4 text-right text-xs font-bold text-ink">{battleAttributes[k]}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 border-t border-ember/15 pt-2">
                          <div className="flex justify-between py-0.5">
                            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                              <Sword className="h-3 w-3 text-ember" /> ATK
                            </span>
                            <span className="text-xs font-bold text-ink">{attack}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                              <Shield className="h-3 w-3 text-gold" /> DEF
                            </span>
                            <span className="text-xs font-bold text-ink">{defense}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* portrait preview */}
                  <div>
                    {portraitUrl ? (
                      <div
                        className="overflow-hidden border border-gold/20 shadow-[0_0_20px_rgba(201,168,76,0.08)]"
                        style={{ clipPath: clipCard }}
                      >
                        <img
                          src={portraitUrl}
                          alt="Retrato"
                          className="aspect-[9/16] w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="flex aspect-[9/16] items-center justify-center border border-gold/10 bg-surface/40"
                        style={{ clipPath: clipCard }}
                      >
                        <div className="text-center">
                          <ImagePlus className="mx-auto h-6 w-6 text-ink-muted" />
                          <p className="mt-2 text-xs text-ink-muted">Sem retrato</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* ── navigation ── */}
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                {currentStepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="flex h-10 items-center gap-1.5 border border-ink/15 bg-surface/40 px-4 text-[10px] font-bold uppercase tracking-wider text-ink-muted transition-all hover:border-ink/30 hover:text-ink"
                    style={{ clipPath: clipBtn }}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="flex h-10 items-center gap-1.5 border border-ember/20 bg-ember/5 px-4 text-[10px] font-bold uppercase tracking-wider text-ember transition-all hover:border-ember/40 hover:bg-ember/10"
                    style={{ clipPath: clipBtn }}
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div>
                {step === 'review' ? (
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirm(true)}
                    disabled={!canSave}
                    className="flex h-10 items-center gap-2 border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/5 px-5 text-[10px] font-bold uppercase tracking-wider text-gold transition-all hover:border-gold/50 hover:from-gold/25 hover:shadow-[0_0_16px_rgba(201,168,76,0.1)] disabled:opacity-30"
                    style={{ clipPath: clipBtn }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Salvar personagem
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={step === 'identity' && name.trim().length < 2}
                    className="flex h-10 items-center gap-1.5 border border-gold/25 bg-gold/10 px-5 text-[10px] font-bold uppercase tracking-wider text-gold transition-all hover:border-gold/40 hover:bg-gold/20 disabled:opacity-30"
                    style={{ clipPath: clipBtn }}
                  >
                    Próximo <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        </div>
      </div>
      )}

      {/* confirm cancel */}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancelar criacao?"
        description="Tem certeza que deseja sair? Todo o progresso sera perdido."
        confirmLabel="Sim, cancelar"
        cancelLabel="Continuar editando"
        variant="danger"
        onConfirm={() => {
          setShowCancelConfirm(false)
          if (worldId) goCharacters(worldId)
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />

      {/* confirm save */}
      <ConfirmDialog
        open={showSaveConfirm}
        title="Salvar personagem?"
        description={`Deseja salvar "${name.trim()}" (${archetype}) com os atributos definidos?`}
        confirmLabel="Salvar"
        cancelLabel="Revisar mais"
        onConfirm={handleSave}
        onCancel={() => setShowSaveConfirm(false)}
      />
    </>
  )
}
