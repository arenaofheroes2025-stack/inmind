/**
 * NPC Detail Agent — generates full NPC details on demand.
 *
 * Called when the player interacts with an NPC from the location summary.
 * Takes the lightweight NpcSummary + world/location context and produces
 * a complete Npc object with personality, dialogue, quest links, etc.
 */

import type { Npc } from '../../data/types'
import type { NarrativeContext } from './shared'
import {
  buildWorldContext,
  buildLocationContext,
  extractContent,
  parseJsonPayload,
} from './shared'
import { createChatCompletion } from '../aiClient'

/* ──────────────────────────────────────────────
   System Prompt
   ────────────────────────────────────────────── */

const NPC_SYSTEM_PROMPT =
  'Voce e um gerador de NPCs detalhados para um RPG narrativo imersivo.\n' +
  'Receba o resumo de um NPC e gere seus detalhes completos.\n' +
  'Regras:\n' +
  '- Responda APENAS com JSON valido. Sem markdown.\n' +
  '- Siga EXATAMENTE o schema fornecido.\n' +
  '- Todo conteudo DEVE ser em PORTUGUES DO BRASIL.\n' +
  '- Crie personalidade rica e coerente com o mundo.\n' +
  '- Gere dialogos imersivos em primeira pessoa.\n' +
  '- Se o NPC e comerciante, liste ids de itens do local que ele venderia.\n' +
  '- Se o NPC oferece quests, liste ids das quests do local.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const NPC_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA:
{
  "npc": {
    "id": string,             // MESMO id fornecido
    "name": string,           // MESMO nome fornecido
    "role": string,           // MESMO role fornecido
    "description": string,    // descricao expandida (2-3 frases)
    "personality": string,    // 2-3 frases sobre temperamento, motivacoes, maneirismos
    "dialogue": [string],     // 3-5 falas tipicas deste NPC em primeira pessoa (com aspas)
    "questIds": [string],     // ids de quests do local que este NPC oferece ([] se nenhuma)
    "inventory": [string],    // ids de itens do local que este NPC vende/possui ([] se nenhum)
    "lore": string            // 2-3 frases sobre a historia pessoal do NPC e sua conexao com o local
  }
}
`

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

export async function generateNpcDetails(
  npcId: string,
  ctx: NarrativeContext,
): Promise<Npc | null> {
  const summary = ctx.content.npcs.find((n) => n.id === npcId)
  if (!summary) return null

  const questIds = [
    ...ctx.content.quests.main.map((q) => q.id),
    ...ctx.content.quests.side.map((q) => q.id),
    ...ctx.content.quests.ambient.map((q) => q.id),
  ]
  const itemIds = ctx.content.items.map((it) => it.id)

  const userPrompt =
    buildWorldContext(ctx.world, ctx.location.id) +
    '\n' +
    buildLocationContext(ctx.location, ctx.content, ctx.activeQuestIds) +
    '\n\nNPC a detalhar:\n' +
    `  ID: ${summary.id}\n` +
    `  Nome: ${summary.name}\n` +
    `  Funcao: ${summary.role}\n` +
    `  Descricao: ${summary.description}\n` +
    (summary.narrativeEffect ? `  Efeito narrativo: ${summary.narrativeEffect}\n` : '') +
    `\nQuests disponiveis no local (ids): ${JSON.stringify(questIds)}\n` +
    `Itens disponiveis no local (ids): ${JSON.stringify(itemIds)}\n` +
    NPC_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: NPC_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 2000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<{ npc: Npc }>(raw)

    if (parsed?.npc) {
      const npc = parsed.npc
      return {
        id: summary.id,
        name: summary.name,
        role: summary.role,
        description: npc.description || summary.description,
        personality: npc.personality || '',
        dialogue: Array.isArray(npc.dialogue) ? npc.dialogue : [],
        questIds: Array.isArray(npc.questIds) ? npc.questIds : [],
        inventory: Array.isArray(npc.inventory) ? npc.inventory : [],
        lore: npc.lore || '',
      }
    }

    console.warn('[NpcAgent] Invalid response')
  } catch (err) {
    console.error('[NpcAgent] Failed:', err)
  }

  // Fallback: return minimal Npc from summary
  return {
    id: summary.id,
    name: summary.name,
    role: summary.role,
    description: summary.description,
  }
}
