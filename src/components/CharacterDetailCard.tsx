import { AnimatePresence, motion } from 'framer-motion'
import {
  Brain,
  Eye,
  Flame,
  Heart,
  Shield,
  Sparkles,
  Star,
  Sword,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import type { Character } from '../data/types'
import { CharacterPortrait } from './CharacterPortrait'
import { HPBar } from './HPBar'

type Props = {
  character: Character
  open: boolean
  onClose: () => void
}

const ACTION_ATTRS: {
  key: keyof Character['actionAttributes']
  label: string
  icon: React.ReactNode
  color: string
}[] = [
  { key: 'forca', label: 'Forca', icon: <Swords className="h-3.5 w-3.5" />, color: 'text-sky-400' },
  { key: 'agilidade', label: 'Agilidade', icon: <Wind className="h-3.5 w-3.5" />, color: 'text-sky-400' },
  { key: 'intelecto', label: 'Intelecto', icon: <Brain className="h-3.5 w-3.5" />, color: 'text-sky-400' },
  { key: 'carisma', label: 'Carisma', icon: <Sparkles className="h-3.5 w-3.5" />, color: 'text-sky-400' },
  { key: 'vontade', label: 'Vontade', icon: <Flame className="h-3.5 w-3.5" />, color: 'text-sky-400' },
  { key: 'percepcao', label: 'Percepcao', icon: <Eye className="h-3.5 w-3.5" />, color: 'text-sky-400' },
]

const BATTLE_ATTRS: {
  key: keyof Character['battleAttributes']
  label: string
  icon: React.ReactNode
  color: string
}[] = [
  { key: 'velocidade', label: 'Velocidade', icon: <Zap className="h-3.5 w-3.5" />, color: 'text-ember' },
  { key: 'ataque', label: 'Ataque', icon: <Sword className="h-3.5 w-3.5" />, color: 'text-ember' },
  { key: 'defesa', label: 'Defesa', icon: <Shield className="h-3.5 w-3.5" />, color: 'text-ember' },
  { key: 'magia', label: 'Magia', icon: <Star className="h-3.5 w-3.5" />, color: 'text-ember' },
]

function StatBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

const BAR_COLORS: Record<string, string> = {
  'text-sky-400': 'bg-sky-400',
  'text-ember': 'bg-ember',
}

export function CharacterDetailCard({ character, open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-b from-panel via-surface to-panel shadow-[0_0_60px_rgba(201,168,76,0.1)] sm:max-w-2xl sm:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* top accent */}
            <div className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

            {/* close */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-ink/10 bg-panel/80 text-ink-muted transition-colors hover:border-gold/30 hover:text-gold"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex flex-col sm:flex-row">
              {/* ── FULL BODY PORTRAIT (desktop) ── */}
              <div className="relative hidden shrink-0 sm:block sm:w-52">
                {character.portraitUrl ? (
                  <img
                    src={character.portraitUrl}
                    alt={character.name}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface text-4xl font-bold text-ink-muted/40">
                    {character.name[0]?.toUpperCase()}
                  </div>
                )}
                {/* gradient overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-panel to-transparent" />
                {/* name overlay */}
                <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
                  <h3 className="font-display text-lg font-bold text-ink drop-shadow-lg">
                    {character.name}
                  </h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gold/90 drop-shadow">
                    {character.archetype}
                  </p>
                </div>
              </div>

              {/* ── RIGHT SIDE / MAIN CONTENT ── */}
              <div className="min-w-0 flex-1">
                {/* ── HEADER (mobile only — circle portrait) ── */}
                <div className="flex items-center gap-4 px-5 pt-5 pb-4 sm:hidden">
                  <CharacterPortrait
                    src={character.portraitUrl}
                    fallback={character.name[0]?.toUpperCase()}
                    variant="arch"
                    size="md"
                    active
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-bold text-ink">
                      {character.name}
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80">
                      {character.archetype}
                    </p>
                    <div className="mt-2 w-full">
                      <HPBar
                        value={character.hp}
                        max={20}
                        label="HP"
                        icon={<Heart />}
                        color="glow"
                        size="sm"
                      />
                    </div>
                    <div className="mt-1 w-full">
                      <HPBar
                        value={character.xp ?? 0}
                        max={(character.level ?? 1) * 100}
                        label={`Nv ${character.level ?? 1} — XP`}
                        color="gold"
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* ── HP BAR (desktop — inside right panel) ── */}
                <div className="hidden px-5 pr-12 pt-5 pb-2 sm:block">
                  <HPBar
                    value={character.hp}
                    max={20}
                    label="HP"
                    icon={<Heart />}
                    color="glow"
                    size="sm"
                  />
                  <div className="mt-1.5">
                    <HPBar
                      value={character.xp ?? 0}
                      max={(character.level ?? 1) * 100}
                      label={`Nv ${character.level ?? 1} — XP`}
                      color="gold"
                      size="sm"
                    />
                  </div>
                </div>

            {/* scrollable body */}
            <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
              {/* ── COMBAT STATS ── */}
              <div className="mb-4 flex gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-ember/15 bg-ember/5 px-3 py-1.5">
                  <Sword className="h-3.5 w-3.5 text-ember" />
                  <span className="text-xs font-bold text-ember">{character.attack}</span>
                  <span className="text-[9px] text-ink-muted">ATK</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-gold/15 bg-gold/5 px-3 py-1.5">
                  <Shield className="h-3.5 w-3.5 text-gold" />
                  <span className="text-xs font-bold text-gold">{character.defense}</span>
                  <span className="text-[9px] text-ink-muted">DEF</span>
                </div>
              </div>

              {/* ── ACTION ATTRIBUTES ── */}
              <div className="mb-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-sky-400/70">
                  <Sparkles className="h-3 w-3" />
                  Atributos de acao
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {ACTION_ATTRS.map(({ key, label, icon, color }) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`shrink-0 ${color}`}>{icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-ink-muted">{label}</span>
                          <span className={`text-xs font-bold ${color}`}>
                            {character.actionAttributes[key]}
                          </span>
                        </div>
                        <StatBar
                          value={character.actionAttributes[key]}
                          color={BAR_COLORS[color] ?? 'bg-gold'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── BATTLE ATTRIBUTES ── */}
              <div className="mb-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-ember/70">
                  <Swords className="h-3 w-3" />
                  Atributos de batalha
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {BATTLE_ATTRS.map(({ key, label, icon, color }) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`shrink-0 ${color}`}>{icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-ink-muted">{label}</span>
                          <span className={`text-xs font-bold ${color}`}>
                            {character.battleAttributes[key]}
                          </span>
                        </div>
                        <StatBar
                          value={character.battleAttributes[key]}
                          color={BAR_COLORS[color] ?? 'bg-gold'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── ADVANTAGES ── */}
              {character.advantages.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-glow/70">
                    <ThumbsUp className="h-3 w-3" />
                    Vantagens
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {character.advantages.map((adv) => (
                      <span
                        key={adv}
                        className="flex items-center gap-1 rounded-full border border-glow/20 bg-glow/5 px-2.5 py-1 text-[10px] font-semibold text-glow"
                      >
                        <Star className="h-2.5 w-2.5" />
                        {adv}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── DISADVANTAGES ── */}
              {character.disadvantages.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-ember/70">
                    <ThumbsDown className="h-3 w-3" />
                    Desvantagens
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {character.disadvantages.map((dis) => (
                      <span
                        key={dis}
                        className="flex items-center gap-1 rounded-full border border-ember/20 bg-ember/5 px-2.5 py-1 text-[10px] font-semibold text-ember"
                      >
                        <Flame className="h-2.5 w-2.5" />
                        {dis}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
            </div>{/* end right side */}
            </div>{/* end flex row */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
