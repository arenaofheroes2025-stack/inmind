import { AnimatePresence, motion } from 'framer-motion'
import {
  Backpack,
  Coins,
  Package,
  Shield,
  ShieldPlus,
  Sparkles,
  Swords,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Character, Equipment, EquipSlot, InventoryItem, ItemRarity } from '../data/types'
import { getEquipment, saveCharacter } from '../services/cache'
import { Badge } from './Badge'
import { CharacterPortrait } from './CharacterPortrait'

type Props = {
  open: boolean
  characters: Character[]
  onClose: () => void
  onCharactersUpdated?: (characters: Character[]) => void
}

const RARITY_CONFIG: Record<ItemRarity, { label: string; color: string; bg: string; border: string }> = {
  comum:    { label: 'Comum',    color: 'text-ink-muted', bg: 'bg-ink/5',      border: 'border-ink/15' },
  incomum:  { label: 'Incomum',  color: 'text-glow',      bg: 'bg-glow/10',    border: 'border-glow/25' },
  raro:     { label: 'Raro',     color: 'text-arcane',    bg: 'bg-arcane/10',  border: 'border-arcane/25' },
  epico:    { label: 'Épico',    color: 'text-gold',      bg: 'bg-gold/10',    border: 'border-gold/25' },
  lendario: { label: 'Lendário', color: 'text-ember',     bg: 'bg-ember/10',   border: 'border-ember/25' },
}

const TYPE_LABELS: Record<string, string> = {
  arma: 'Arma', armadura: 'Armadura', escudo: 'Escudo', pocao: 'Poção',
  pergaminho: 'Pergaminho', amuleto: 'Amuleto', anel: 'Anel',
  ferramenta: 'Ferramenta', material: 'Material', chave: 'Chave', tesouro: 'Tesouro',
}

const USAGE_LABELS: Record<string, string> = {
  batalha: 'Batalha', 'pre-acao': 'Pré-Ação', ambos: 'Ambos',
  passivo: 'Passivo', narrativo: 'Narrativo',
}

const SLOT_LABELS: Record<EquipSlot, string> = {
  arma: 'Arma', armadura: 'Armadura', escudo: 'Escudo', acessorio: 'Acessório',
}

const SLOT_ICONS: Record<EquipSlot, React.ReactNode> = {
  arma: <Swords className="h-3.5 w-3.5" />,
  armadura: <Shield className="h-3.5 w-3.5" />,
  escudo: <ShieldPlus className="h-3.5 w-3.5" />,
  acessorio: <Sparkles className="h-3.5 w-3.5" />,
}

/** Map equipment type to equip slot */
function typeToSlot(type: string): EquipSlot | null {
  switch (type) {
    case 'arma': return 'arma'
    case 'armadura': return 'armadura'
    case 'escudo': return 'escudo'
    case 'amuleto':
    case 'anel': return 'acessorio'
    default: return null
  }
}

export function InventoryPanel({ open, characters, onClose, onCharactersUpdated }: Props) {
  const [selectedCharIdx, setSelectedCharIdx] = useState(0)
  const [resolvedItems, setResolvedItems] = useState<Map<string, Equipment>>(new Map())
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const char = characters[selectedCharIdx] ?? characters[0]

  // Resolve equipment data for all inventory items
  useEffect(() => {
    if (!open || !char) return
    const ids = char.inventory.map((inv) => inv.equipmentId)
    const unique = [...new Set(ids)]
    Promise.all(unique.map(async (id) => {
      const eq = await getEquipment(id)
      return eq ? [id, eq] as [string, Equipment] : null
    })).then((results) => {
      const map = new Map<string, Equipment>()
      for (const r of results) {
        if (r) map.set(r[0], r[1])
      }
      setResolvedItems(map)
    })
  }, [open, char, char?.inventory.length])

  // Reset selection when opening
  useEffect(() => {
    if (open) {
      setSelectedCharIdx(0)
      setExpandedItem(null)
    }
  }, [open])

  const handleEquip = async (inv: InventoryItem, slot: EquipSlot) => {
    if (!char) return
    const equippedItems = { ...(char.equippedItems ?? { arma: null, armadura: null, escudo: null, acessorio: null }) }
    equippedItems[slot] = inv.equipmentId
    const updated = { ...char, equippedItems }
    await saveCharacter(updated)
    const newChars = characters.map((c) => c.id === updated.id ? updated : c)
    onCharactersUpdated?.(newChars)
  }

  const handleUnequip = async (slot: EquipSlot) => {
    if (!char) return
    const equippedItems = { ...(char.equippedItems ?? { arma: null, armadura: null, escudo: null, acessorio: null }) }
    equippedItems[slot] = null
    const updated = { ...char, equippedItems }
    await saveCharacter(updated)
    const newChars = characters.map((c) => c.id === updated.id ? updated : c)
    onCharactersUpdated?.(newChars)
  }

  const equippedItems = char?.equippedItems ?? { arma: null, armadura: null, escudo: null, acessorio: null }
  const equippedIds = new Set(Object.values(equippedItems).filter(Boolean))

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-obsidian/95 backdrop-blur-md"
        >
          {/* Header */}
          <div className="relative border-b border-gold/15 bg-panel/90 backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <Badge label="Inventário" variant="gold" icon={<Backpack />} />
                {char && (
                  <span className="text-[10px] text-ink-muted">
                    {char.name} — {char.inventory.length} {char.inventory.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink-muted hover:border-gold/30 hover:text-gold"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Character tabs */}
          {characters.length > 1 && (
            <div className="mx-auto w-full max-w-3xl">
              <div className="flex gap-2 border-b border-ink/10 px-4 py-2 overflow-x-auto sm:px-6">
                {characters.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCharIdx(i); setExpandedItem(null) }}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      i === selectedCharIdx
                        ? 'border-gold/40 bg-gold/10 text-gold'
                        : 'border-ink/10 text-ink-muted hover:border-ink/20'
                    }`}
                  >
                    <CharacterPortrait
                      src={c.portraitUrl}
                      fallback={c.name[0]?.toUpperCase()}
                      size="xs"
                      variant="circle"
                      active={i === selectedCharIdx}
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 space-y-4">
            {char && (
              <>
                {/* Gold display */}
                <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2">
                  <Coins className="h-4 w-4 text-gold" />
                  <span className="text-sm font-bold text-gold">{char.gold ?? 0}</span>
                  <span className="text-[10px] text-gold/60 uppercase tracking-wider">ouro</span>
                </div>

                {/* Equip slots */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-gold/60">
                    Equipamentos
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(['arma', 'armadura', 'escudo', 'acessorio'] as EquipSlot[]).map((slot) => {
                      const eqId = equippedItems[slot]
                      const eq = eqId ? resolvedItems.get(eqId) : null
                      const rarity = eq ? RARITY_CONFIG[eq.rarity as ItemRarity] ?? RARITY_CONFIG.comum : null
                      return (
                        <div
                          key={slot}
                          className={`rounded-lg border p-2.5 ${
                            eq ? `${rarity!.border} ${rarity!.bg}` : 'border-ink/10 bg-ink/3'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={eq ? rarity!.color : 'text-ink-muted/40'}>
                              {SLOT_ICONS[slot]}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-ink-muted">
                              {SLOT_LABELS[slot]}
                            </span>
                          </div>
                          {eq ? (
                            <div>
                              <p className={`text-[11px] font-bold ${rarity!.color}`}>{eq.name}</p>
                              <p className="text-[9px] text-ink-muted mt-0.5">{rarity!.label}</p>
                              <button
                                type="button"
                                onClick={() => handleUnequip(slot)}
                                className="mt-1.5 text-[8px] text-ember/70 underline hover:text-ember"
                              >
                                Desequipar
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] text-ink-muted/40 italic">Vazio</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Inventory list */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-gold/60">
                    <Package className="inline h-3 w-3 mr-1" />
                    Mochila ({char.inventory.length} {char.inventory.length === 1 ? 'item' : 'itens'})
                  </p>
                  {char.inventory.length === 0 ? (
                    <div className="rounded-lg border border-ink/10 bg-ink/3 p-6 text-center">
                      <Package className="mx-auto h-8 w-8 text-ink-muted/30 mb-2" />
                      <p className="text-xs text-ink-muted/50">Mochila vazia</p>
                      <p className="text-[10px] text-ink-muted/30 mt-1">Explore o mundo para encontrar itens</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {char.inventory.map((inv) => {
                        const eq = resolvedItems.get(inv.equipmentId)
                        if (!eq) return null
                        const rarity = RARITY_CONFIG[eq.rarity as ItemRarity] ?? RARITY_CONFIG.comum
                        const isEquipped = equippedIds.has(inv.equipmentId)
                        const isExpanded = expandedItem === inv.id
                        const slot = typeToSlot(eq.type)
                        const bonusEntries = Object.entries(eq.bonus || {}).filter(([, v]) => v !== 0)
                        return (
                          <motion.div
                            key={inv.id}
                            layout
                            className={`rounded-lg border ${rarity.border} ${rarity.bg} overflow-hidden`}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedItem(isExpanded ? null : inv.id)}
                              className="w-full px-3 py-2.5 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-lg ${rarity.color}`}>
                                  {eq.type === 'arma' ? '⚔️' : eq.type === 'armadura' ? '🛡️' : eq.type === 'escudo' ? '🛡️' :
                                   eq.type === 'pocao' ? '🧪' : eq.type === 'pergaminho' ? '📜' : eq.type === 'amuleto' ? '📿' :
                                   eq.type === 'anel' ? '💍' : eq.type === 'ferramenta' ? '🔧' : eq.type === 'material' ? '🧱' :
                                   eq.type === 'chave' ? '🔑' : eq.type === 'tesouro' ? '💎' : '📦'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-bold ${rarity.color}`}>{eq.name}</span>
                                    {inv.quantity > 1 && (
                                      <span className="rounded-full bg-ink/10 px-1.5 text-[9px] font-bold text-ink-muted">
                                        x{inv.quantity}
                                      </span>
                                    )}
                                    {isEquipped && (
                                      <span className="rounded-full border border-glow/30 bg-glow/10 px-1.5 text-[8px] font-bold text-glow uppercase">
                                        Equipado
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`text-[9px] ${rarity.color}`}>{rarity.label}</span>
                                    <span className="text-[8px] text-ink-muted">•</span>
                                    <span className="text-[9px] text-ink-muted">{TYPE_LABELS[eq.type] ?? eq.type}</span>
                                  </div>
                                </div>
                                {(eq.sellPrice ?? 0) > 0 && (
                                  <span className="flex items-center gap-0.5 text-[9px] text-gold">
                                    <Coins className="h-2.5 w-2.5" />
                                    {eq.sellPrice}
                                  </span>
                                )}
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-ink/10"
                                >
                                  <div className="px-3 py-2.5 space-y-2">
                                    <p className="text-[10px] text-ink-muted leading-relaxed">{eq.description}</p>
                                    {eq.narrativeEffect && (
                                      <p className="text-[10px] text-arcane/70 italic">✦ {eq.narrativeEffect}</p>
                                    )}
                                    {/* Stats */}
                                    <div className="flex flex-wrap gap-1.5">
                                      <span className="rounded-full border border-ink/10 bg-ink/5 px-2 py-0.5 text-[8px] font-semibold text-ink-muted">
                                        {USAGE_LABELS[eq.usageContext] ?? eq.usageContext}
                                      </span>
                                      {eq.consumable && (
                                        <span className="rounded-full border border-ember/20 bg-ember/5 px-2 py-0.5 text-[8px] font-semibold text-ember">
                                          Consumível
                                        </span>
                                      )}
                                      {eq.difficultyReduction && (eq.difficultyReduction ?? 0) > 0 && (
                                        <span className="rounded-full border border-glow/20 bg-glow/5 px-2 py-0.5 text-[8px] font-semibold text-glow">
                                          −{eq.difficultyReduction} Dificuldade
                                        </span>
                                      )}
                                      {eq.hpRestore && (eq.hpRestore ?? 0) > 0 && (
                                        <span className="rounded-full border border-glow/20 bg-glow/5 px-2 py-0.5 text-[8px] font-semibold text-glow">
                                          +{eq.hpRestore} HP
                                        </span>
                                      )}
                                      {bonusEntries.map(([attr, val]) => (
                                        <span key={attr} className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${
                                          val > 0 ? 'border-glow/20 bg-glow/5 text-glow' : 'border-ember/20 bg-ember/5 text-ember'
                                        }`}>
                                          {val > 0 ? '+' : ''}{val} {attr}
                                        </span>
                                      ))}
                                    </div>
                                    {/* Actions */}
                                    <div className="flex gap-2 pt-1">
                                      {eq.equippable && slot && !isEquipped && (
                                        <button
                                          type="button"
                                          onClick={() => handleEquip(inv, slot)}
                                          className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-bold text-gold hover:bg-gold/20 transition-colors"
                                        >
                                          Equipar ({SLOT_LABELS[slot]})
                                        </button>
                                      )}
                                      {isEquipped && slot && (
                                        <button
                                          type="button"
                                          onClick={() => handleUnequip(slot)}
                                          className="rounded-lg border border-ember/30 bg-ember/10 px-3 py-1.5 text-[10px] font-bold text-ember hover:bg-ember/20 transition-colors"
                                        >
                                          Desequipar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
