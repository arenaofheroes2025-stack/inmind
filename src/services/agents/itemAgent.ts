/**
 * Item Detail Agent — generates full Equipment details on demand.
 *
 * Called when the player obtains or interacts with an item from the location summary.
 * Takes the lightweight ItemSummary + world/location context and produces
 * a complete Equipment object with full stats, pricing, and mechanics.
 */

import type { Equipment } from '../../data/types'
import type { NarrativeContext } from './shared'
import {
  buildWorldContext,
  buildLocationContext,
  buildPartyContext,
  extractContent,
  parseJsonPayload,
} from './shared'
import { createChatCompletion } from '../aiClient'

/* ──────────────────────────────────────────────
   System Prompt
   ────────────────────────────────────────────── */

const ITEM_SYSTEM_PROMPT =
  'Voce e um gerador de itens detalhados para um RPG narrativo imersivo.\n' +
  'Receba o resumo de um item e gere seus detalhes completos com stats de jogo.\n' +
  'Regras:\n' +
  '- Responda APENAS com JSON valido. Sem markdown.\n' +
  '- Siga EXATAMENTE o schema fornecido. TODOS os campos sao OBRIGATORIOS.\n' +
  '- Todo conteudo DEVE ser em PORTUGUES DO BRASIL.\n' +
  '- Distribua raridades: ~40% comum, ~30% incomum, ~20% raro, ~8% epico, ~2% lendario.\n' +
  '- Ajuste precos por raridade: comum:5-20, incomum:25-60, raro:70-150, epico:200-500, lendario:500+.\n' +
  '- Faca bonus coerentes com o tipo do item e a tematica do mundo.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const ITEM_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA:
{
  "equipment": {
    "id": string,               // MESMO id fornecido
    "name": string,             // MESMO nome fornecido
    "type": string,             // MESMO tipo fornecido. VALORES: "arma"|"armadura"|"escudo"|"pocao"|"pergaminho"|"amuleto"|"anel"|"ferramenta"|"material"|"chave"|"tesouro"
    "rarity": string,           // VALORES: "comum"|"incomum"|"raro"|"epico"|"lendario"
    "description": string,      // descricao expandida (2-3 frases)
    "narrativeEffect": string,  // flavor text do uso no mundo
    "usageContext": string,     // VALORES: "batalha"|"pre-acao"|"ambos"|"passivo"|"narrativo"
    "bonus": object,            // bonus passivo: chave=atributo, valor=numero. ATRIBUTOS: "forca"|"agilidade"|"intelecto"|"percepcao"|"carisma"|"vontade"|"velocidade"|"ataque"|"defesa"|"magia". Pode ser {} se nenhum.
    "difficultyReduction": number, // 0-5: reducao de dificuldade quando usado pre-acao
    "hpRestore": number,        // HP restaurado ao usar (0 se nao aplica)
    "sellPrice": number,        // preco de venda em ouro (0 = nao vendavel)
    "consumable": boolean,      // true = destruido apos uso
    "equippable": boolean,      // true = pode equipar em slot
    "stackable": boolean        // true = pode acumular quantidade
  }
}
`

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Generate full Equipment details from an ItemSummary.
 * Pass the item id from LocationContent.items.
 */
export async function generateItemDetails(
  itemId: string,
  ctx: NarrativeContext,
): Promise<Equipment | null> {
  const summary = ctx.content.items.find((it) => it.id === itemId)
  if (!summary) return null

  const userPrompt =
    buildWorldContext(ctx.world, ctx.location.id) +
    '\n' +
    buildLocationContext(ctx.location, ctx.content, ctx.activeQuestIds) +
    '\n' +
    buildPartyContext(ctx.characters, ctx.equipmentMap) +
    '\n\nItem a detalhar:\n' +
    `  ID: ${summary.id}\n` +
    `  Nome: ${summary.name}\n` +
    `  Tipo: ${summary.type}\n` +
    `  Descricao: ${summary.description}\n` +
    (summary.narrativeEffect ? `  Efeito narrativo: ${summary.narrativeEffect}\n` : '') +
    `\nNivel de perigo do local: ${ctx.location.dangerLevel}/10\n` +
    ITEM_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: ITEM_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 2000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<{ equipment: Record<string, unknown> }>(raw)

    if (parsed?.equipment) {
      const eq = parsed.equipment
      return {
        id: summary.id,
        name: summary.name,
        type: (eq.type as string) || summary.type,
        rarity: (eq.rarity as string) || 'comum',
        description: String(eq.description || summary.description),
        narrativeEffect: String(eq.narrativeEffect || summary.narrativeEffect || ''),
        usageContext: (eq.usageContext as string) || 'passivo',
        bonus: (eq.bonus as Record<string, number>) || {},
        difficultyReduction: Number(eq.difficultyReduction) || 0,
        hpRestore: Number(eq.hpRestore) || 0,
        sellPrice: Number(eq.sellPrice) || 0,
        consumable: Boolean(eq.consumable),
        equippable: Boolean(eq.equippable),
        stackable: Boolean(eq.stackable),
      } as Equipment
    }

    console.warn('[ItemAgent] Invalid response')
  } catch (err) {
    console.error('[ItemAgent] Failed:', err)
  }

  // Fallback: minimal Equipment from summary
  return {
    id: summary.id,
    name: summary.name,
    type: summary.type,
    rarity: 'comum',
    description: summary.description,
    narrativeEffect: summary.narrativeEffect || '',
    usageContext: 'passivo',
    bonus: {},
    difficultyReduction: 0,
    hpRestore: 0,
    sellPrice: 5,
    consumable: false,
    equippable: false,
    stackable: false,
  } as Equipment
}

/**
 * Generate a complete Equipment item from free-form context (e.g. loot generation).
 * Used when AI narrates an item that's not in the location summary.
 */
export async function generateFreeItem(
  ctx: NarrativeContext,
  itemName: string,
  itemContext: string,
): Promise<Equipment | null> {
  const userPrompt =
    buildWorldContext(ctx.world, ctx.location.id) +
    '\n' +
    buildLocationContext(ctx.location, ctx.content, ctx.activeQuestIds) +
    '\n\nGere os detalhes completos para o seguinte item:\n' +
    `  Nome: ${itemName}\n` +
    `  Contexto: ${itemContext}\n` +
    `\nNivel de perigo do local: ${ctx.location.dangerLevel}/10\n` +
    ITEM_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: ITEM_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 2000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<{ equipment: Record<string, unknown> }>(raw)

    if (parsed?.equipment) {
      const eq = parsed.equipment
      return {
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: String(eq.name || itemName),
        type: (eq.type as string) || 'ferramenta',
        rarity: (eq.rarity as string) || 'comum',
        description: String(eq.description || ''),
        narrativeEffect: String(eq.narrativeEffect || ''),
        usageContext: (eq.usageContext as string) || 'passivo',
        bonus: (eq.bonus as Record<string, number>) || {},
        difficultyReduction: Number(eq.difficultyReduction) || 0,
        hpRestore: Number(eq.hpRestore) || 0,
        sellPrice: Number(eq.sellPrice) || 0,
        consumable: Boolean(eq.consumable),
        equippable: Boolean(eq.equippable),
        stackable: Boolean(eq.stackable),
      } as Equipment
    }
  } catch (err) {
    console.error('[ItemAgent] Free item generation failed:', err)
  }

  return null
}
