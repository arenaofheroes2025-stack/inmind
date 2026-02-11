/**
 * Shared types, helpers, and context builders used by all narrative AI agents.
 */

import type {
  Character,
  Equipment,
  Location,
  LocationContent,
  World,
} from '../../data/types'

/* ──────────────────────────────────────────────
   Shared Types
   ────────────────────────────────────────────── */

export type NarrativeContext = {
  world: World
  location: Location
  content: LocationContent
  characters: Character[]
  previousActions?: string[]
  activeQuestIds?: string[]
  previousMood?: NarrativeMood
  previousSceneDescription?: string
  /** Resolved equipment map: equipmentId → Equipment (for inventory context) */
  equipmentMap?: Map<string, Equipment>
}

export type NarrativeMood =
  | 'Neutro'
  | 'Alegre'
  | 'Triste'
  | 'Inspirador'
  | 'Medo'
  | 'Tensão'
  | 'Mistério'
  | 'Sombrio'
  | 'Combate'
  | 'Vitória'

export const VALID_MOODS: NarrativeMood[] = [
  'Neutro', 'Alegre', 'Triste', 'Inspirador', 'Medo',
  'Tensão', 'Mistério', 'Sombrio', 'Combate', 'Vitória',
]

export type NarrativeResult = {
  title: string
  description: string
  mood: NarrativeMood
}

export type OutcomeNarrative = {
  text: string
  consequence: string
  /** @deprecated Loot is now handled separately by lootGenerator. Kept for backward compatibility. */
  itemsObtained?: ItemGrant[]
  /** @deprecated Gold is now handled separately by lootGenerator. Kept for backward compatibility. */
  goldObtained?: GoldChange[]
}

export type ItemGrant = {
  characterId: string
  item: {
    id: string
    name: string
    type: string
    rarity: string
    description: string
    narrativeEffect: string
    usageContext: string
    bonus: Record<string, number>
    difficultyReduction: number
    hpRestore: number
    sellPrice: number
    consumable: boolean
    equippable: boolean
    stackable: boolean
  }
  quantity: number
}

export type GoldChange = {
  characterId: string
  amount: number       // positive = gained, negative = spent
}

export type LootResult = {
  items: ItemGrant[]
  gold: GoldChange[]
}

export type CustomActionInput = {
  characterId: string
  characterName: string
  actionText: string
}

export type ValidatedAction = {
  characterId: string
  characterName: string
  valid: boolean
  reason: string
  description: string
  primaryAttribute: string
  difficulty: number
  riskLevel: 'low' | 'medium' | 'high'
  affectsInventory: boolean
}

/* ──────────────────────────────────────────────
   JSON Parsing
   ────────────────────────────────────────────── */

export function parseJsonPayload<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  const json = raw.slice(start, end + 1)
  try {
    return JSON.parse(json) as T
  } catch {
    try {
      let repaired = json
      const openBraces = (repaired.match(/{/g) || []).length
      const closeBraces = (repaired.match(/}/g) || []).length
      const openBrackets = (repaired.match(/\[/g) || []).length
      const closeBrackets = (repaired.match(/]/g) || []).length
      repaired = repaired.replace(/,\s*$/, '')
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']'
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}'
      const result = JSON.parse(repaired) as T
      console.warn('[NarrativeAgent] JSON repaired from truncated response')
      return result
    } catch {
      console.error('[NarrativeAgent] JSON parse failed even after repair. Raw:', json.slice(0, 800))
      return null
    }
  }
}

/* ──────────────────────────────────────────────
   Response Extraction
   ────────────────────────────────────────────── */

export function extractContent(response: Record<string, unknown>): string {
  const choices = response?.choices as
    | Array<{
        message?: {
          content?: string | null
          reasoning_content?: string
          refusal?: string
        }
        text?: string
        finish_reason?: string
      }>
    | undefined

  if (choices?.[0]) {
    const choice = choices[0]
    if (choice.finish_reason === 'content_filter') {
      console.error('[NarrativeAgent] Response blocked by content filter')
    }
    if (choice.message?.refusal) {
      console.error('[NarrativeAgent] Model refused:', choice.message.refusal)
    }
    if (choice.message?.content && choice.message.content.length > 0)
      return choice.message.content
    if (
      choice.message?.reasoning_content &&
      choice.message.reasoning_content.length > 0
    )
      return choice.message.reasoning_content
    if (choice.text) return choice.text
  }

  const output = response?.output
  if (typeof output === 'string' && output.length > 0) return output
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.content && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block?.text) return String(block.text)
        }
      }
      if (item?.text) return String(item.text)
      if (item?.message?.content) return String(item.message.content)
    }
  }
  if (response?.result && typeof response.result === 'string')
    return response.result

  console.error(
    '[NarrativeAgent] No content in response:',
    JSON.stringify(response).slice(0, 1000),
  )
  return ''
}

/* ──────────────────────────────────────────────
   Context Builders
   ────────────────────────────────────────────── */

export function buildWorldContext(world: World, currentLocationId?: string): string {
  const currentActIdx = currentLocationId
    ? world.acts.findIndex((a) =>
        a.linkedLocations?.some((ref) => ref.id === currentLocationId),
      )
    : -1

  const actsText = world.acts
    .map((a, i) => {
      let status = ''
      if (currentActIdx >= 0) {
        if (i < currentActIdx) status = ' [CONCLUIDO]'
        else if (i === currentActIdx) status = ' [ATO ATUAL]'
        else status = ' [FUTURO]'
      }
      return `  ${i + 1}. "${a.title}" — ${a.goal}${status}`
    })
    .join('\n')

  const currentAct =
    currentActIdx >= 0 ? world.acts[currentActIdx] : undefined

  return (
    `Mundo: "${world.title}"\n` +
    `Genero: ${world.genre}\n` +
    `Tom: ${world.tone}\n` +
    (world.narrativeStyle ? `Estilo narrativo: ${world.narrativeStyle}\n` : '') +
    `Sinopse: ${world.synopsis}\n` +
    `Objetivo final: ${world.finalObjective}\n` +
    `Atos da historia:\n${actsText}\n` +
    (currentAct
      ? `\nATO ATUAL: "${currentAct.title}"\n` +
        `Objetivo do ato: ${currentAct.goal}\n`
      : '')
  )
}

export function buildLocationContext(
  location: Location,
  content: LocationContent,
  activeQuestIds?: string[],
): string {
  const npcs = content.npcs
    .map((n) => `  - ${n.name} (${n.role}): ${n.description}`)
    .join('\n')

  const allQuests = [
    ...content.quests.main.map((q) => {
      const active = activeQuestIds?.includes(q.id) ? ' [ATIVA]' : ''
      return `  [principal${active}] ${q.title}: ${q.description}`
    }),
    ...content.quests.side.map((q) => {
      const active = activeQuestIds?.includes(q.id) ? ' [ATIVA]' : ''
      return `  [secundaria${active}] ${q.title}: ${q.description}`
    }),
    ...content.quests.ambient.map((q) => {
      const active = activeQuestIds?.includes(q.id) ? ' [ATIVA]' : ''
      return `  [ambiente${active}] ${q.title}: ${q.description}`
    }),
  ].join('\n')

  const enemies = content.enemies
    .map((e) => `  - ${e.name}: ${e.description}`)
    .join('\n')
  const items = content.items
    .map((it) => `  - [item:${it.name}] (${it.type}): ${it.description}`)
    .join('\n')

  return (
    `Local atual: "${location.name}" (${location.type})\n` +
    (location.description ? `Descricao: ${location.description}\n` : '') +
    `Nivel de perigo: ${location.dangerLevel}/10\n` +
    `Relevancia: ${location.storyRelevance}\n` +
    `Impacto narrativo: ${content.narrativeImpact}\n` +
    (npcs ? `NPCs presentes:\n${npcs}\n` : '') +
    (allQuests ? `Quests disponiveis:\n${allQuests}\n` : '') +
    (enemies ? `Ameacas no local:\n${enemies}\n` : '') +
    (items ? `Itens encontraveis:\n${items}\n` : '')
  )
}

export function buildPartyContext(characters: Character[], equipmentMap?: Map<string, Equipment>): string {
  if (characters.length === 0) return ''
  return (
    'Grupo de aventureiros:\n' +
    characters
      .map((c) => {
        const attrs =
          `Forca:${c.actionAttributes.forca} Agilidade:${c.actionAttributes.agilidade}` +
          ` Intelecto:${c.actionAttributes.intelecto} Carisma:${c.actionAttributes.carisma}` +
          ` Vontade:${c.actionAttributes.vontade} Percepcao:${c.actionAttributes.percepcao}`
        const battle =
          `Ataque:${c.battleAttributes.ataque} Defesa:${c.battleAttributes.defesa}` +
          ` Velocidade:${c.battleAttributes.velocidade} Magia:${c.battleAttributes.magia}`
        const skills = c.skills?.length
          ? `  Habilidades: ${c.skills.map((s) => `${s.name}(${s.level})`).join(', ')}\n`
          : ''
        const advantages = c.advantages?.length
          ? `  Vantagens: ${c.advantages.join(', ')}\n`
          : ''
        const disadvantages = c.disadvantages?.length
          ? `  Desvantagens: ${c.disadvantages.join(', ')}\n`
          : ''
        const inventoryItems = c.inventory?.length
          ? `  Inventario: ${c.inventory.map((inv) => {
              const eq = equipmentMap?.get(inv.equipmentId)
              const name = eq ? eq.name : inv.equipmentId
              return `[item:${name}](x${inv.quantity})`
            }).join(', ')}\n`
          : '  Inventario: vazio\n'
        const goldText = `  Ouro: ${c.gold ?? 0}\n`
        return (
          `  - ${c.name} [ID: ${c.id}] (${c.archetype}), Nv ${c.level ?? 1}, HP ${c.hp}/20, XP ${c.xp ?? 0}/${(c.level ?? 1) * 100}\n` +
          `  Atributos: ${attrs}\n` +
          `  Combate: ${battle}\n` +
          skills +
          advantages +
          disadvantages +
          inventoryItems +
          goldText
        )
      })
      .join('')
  )
}

/**
 * Build a concise block listing all items already owned by the party,
 * so the narrator avoids offering them again.
 */
export function buildOwnedItemsContext(characters: Character[], equipmentMap?: Map<string, Equipment>): string {
  const owned: string[] = []
  for (const c of characters) {
    for (const inv of c.inventory ?? []) {
      const eq = equipmentMap?.get(inv.equipmentId)
      const name = eq ? eq.name : inv.equipmentId
      owned.push(`[item:${name}] (${c.name}, x${inv.quantity})`)
    }
  }
  if (owned.length === 0) return ''
  return (
    '\nITENS JA POSSUIDOS PELO GRUPO (NAO oferecer novamente como descoberta ou interacao):\n' +
    owned.map((o) => `  - ${o}`).join('\n') + '\n' +
    'REGRA: Os itens listados acima JA ESTAO na mochila dos jogadores. NAO os apresente como [item:] descobriveis na narrativa. ' +
    'Se um jogador ja possui um item, NAO descreva esse item como algo novo no cenario. Introduza OUTROS itens ou elementos diferentes.\n'
  )
}
