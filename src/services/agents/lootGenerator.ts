/**
 * Loot Generator Agent — AI that generates items and gold rewards.
 *
 * Responsibilities:
 * - Generate complete item JSON when a player action results in loot
 * - Generate gold rewards/costs proportional to the action context
 * - Apply rarity scaling based on outcome (critical > success > partial)
 * - Ensure items are coherent with the world, location, and equipment list
 * - Never grant items on failure
 *
 * This agent is called ONLY when:
 *   affectsInventory === true AND outcome is success/partial/critical
 *
 * It receives the scene text (with tags like [item:]) as context for coherence.
 * It does NOT: narrate, produce tags, validate actions, or handle reputation.
 */

import type { NarrativeContext, ItemGrant, GoldChange, LootResult } from './shared'
import {
  buildLocationContext,
  buildPartyContext,
  extractContent,
  parseJsonPayload,
} from './shared'
import type { Choice, RollOutcome } from '../../systems/narrative'
import { createChatCompletion } from '../aiClient'

/* ──────────────────────────────────────────────
   System Prompt — Loot Generator
   ────────────────────────────────────────────── */

const LOOT_SYSTEM_PROMPT =
  'Voce e um gerador de itens e recompensas de RPG. Sua tarefa e criar itens coerentes com o mundo e o contexto da acao.\n' +
  'Gere itens COMPLETOS com TODOS os campos obrigatorios do schema. Nao omita nenhum campo.\n' +
  'Regras:\n' +
  '- SUCESSO CRITICO: item de raridade MAIOR (incomum→raro, raro→epico). Ouro extra.\n' +
  '- SUCESSO: item de raridade adequada (comum ou incomum). Ouro se aplicavel.\n' +
  '- PARCIAL: item de raridade menor ou com defeito (bonus reduzidos). Pouco ou nenhum ouro.\n' +
  '- FALHA/FALHA CRITICA: NUNCA gere itens. itemsObtained deve ser [].\n' +
  '- Itens devem ser coerentes com o mundo, local e contexto narrativo.\n' +
  '- Para comercio: o preco deve fazer sentido economico.\n' +
  '- Responda APENAS com JSON valido. Sem markdown.\n' +
  '- Toda saida DEVE ser em PORTUGUES DO BRASIL.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const LOOT_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA (siga EXATAMENTE):
{
  "items": [
    {
      "characterId": string,  // ID do personagem que recebe o item
      "item": {
        "id": string,         // formato: "gen-item-{numeros}" — gere um id unico
        "name": string,       // nome do item em portugues
        "type": string,       // VALORES: "arma" | "armadura" | "escudo" | "pocao" | "pergaminho" | "amuleto" | "anel" | "ferramenta" | "material" | "chave" | "tesouro"
        "rarity": string,     // VALORES: "comum" | "incomum" | "raro" | "epico" | "lendario"
        "description": string, // 1-2 frases descritivas
        "narrativeEffect": string, // flavor text do uso
        "usageContext": string, // VALORES: "batalha" | "pre-acao" | "ambos" | "passivo" | "narrativo"
        "bonus": object,      // bonus passivo: chave=atributo, valor=numero. Ex: {"forca": 1} ou {} se nenhum. ATRIBUTOS: "forca"|"agilidade"|"intelecto"|"percepcao"|"carisma"|"vontade"|"velocidade"|"ataque"|"defesa"|"magia"
        "difficultyReduction": number, // 0-5: reducao de dificuldade se usado pre-acao
        "hpRestore": number,  // HP restaurado ao usar (0 se nao aplica)
        "sellPrice": number,  // preco de venda em ouro
        "consumable": boolean, // true = destruido apos uso
        "equippable": boolean, // true = pode equipar em slot
        "stackable": boolean  // true = pode acumular quantidade
      },
      "quantity": number      // quantidade obtida (normalmente 1)
    }
  ],
  "gold": [
    {
      "characterId": string,  // ID do personagem
      "amount": number        // positivo = ganhou, negativo = perdeu
    }
  ]
}
OBRIGATORIO: Em SUCESSO ou SUCESSO CRITICO, "items" DEVE ter pelo menos 1 item com TODOS os campos preenchidos.
Em PARCIAL, pode ter 1 item de raridade menor ou items: [].
Se nenhum ouro, use "gold": [].
`

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Generate loot (items + gold) for a successful action.
 * Should only be called when affectsInventory === true AND outcome is not fail/critical-fail.
 */
export async function generateLoot(
  ctx: NarrativeContext,
  choice: Choice,
  outcome: RollOutcome,
  rollTotal: number,
  characterId?: string,
  sceneDescription?: string,
): Promise<LootResult> {
  const { location, content, characters, equipmentMap } = ctx

  const outcomeLabel: Record<RollOutcome, string> = {
    'critical-fail': 'FALHA CRITICA',
    fail: 'FALHA',
    partial: 'SUCESSO PARCIAL',
    success: 'SUCESSO',
    critical: 'SUCESSO CRITICO',
  }

  const targetChar = characterId
    ? characters.find((c) => c.id === characterId)
    : characters[0]

  const userPrompt =
    buildLocationContext(location, content) +
    '\n\n' +
    buildPartyContext(characters, equipmentMap) +
    '\n\n' +
    (sceneDescription
      ? `CENA ATUAL (contexto com tags [item:] para referencia):\n"${sceneDescription.slice(0, 800)}"\n\n`
      : '') +
    `Acao realizada: "${choice.description}"\n` +
    `Personagem: ${targetChar?.name ?? 'Aventureiro'} (ID: ${targetChar?.id ?? characterId ?? 'unknown'})\n` +
    `Resultado: ${rollTotal} → ${outcomeLabel[outcome]}\n` +
    `Dificuldade: ${choice.difficulty}\n\n` +
    'TAREFA: Gere os itens e ouro obtidos por esta acao.\n' +
    '- O item deve ser COERENTE com o mundo, local e acao realizada.\n' +
    '- Se a acao envolve um [item:] tag da cena, use dados similares.\n' +
    '- Se nao, INVENTE um item novo coerente com o contexto.\n' +
    '- Gere um ID unico no formato: "gen-" + numeros aleatorios.\n' +
    '- TODOS os campos do item sao OBRIGATORIOS. Nao omita nenhum.\n\n' +
    LOOT_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: LOOT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 2000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<{ items: ItemGrant[]; gold: GoldChange[] }>(raw)

    if (parsed) {
      const items = Array.isArray(parsed.items) ? parsed.items : []
      const gold = Array.isArray(parsed.gold) ? parsed.gold : []

      console.log('[LootGenerator] Items:', JSON.stringify(items))
      console.log('[LootGenerator] Gold:', JSON.stringify(gold))

      // Validate items have all required fields
      const validItems = items.filter((g) => g.item?.name && g.item?.type && g.item?.rarity)

      return { items: validItems, gold }
    }

    console.warn('[LootGenerator] Invalid loot response')
  } catch (err) {
    console.error('[LootGenerator] Loot generation failed:', err)
  }

  // Fallback: generate item from location equipment
  return buildFallbackLoot(ctx, outcome, characterId)
}

/* ──────────────────────────────────────────────
   Fallback
   ────────────────────────────────────────────── */

function buildFallbackLoot(
  ctx: NarrativeContext,
  outcome: RollOutcome,
  characterId?: string,
): LootResult {
  const locItems = ctx.content.items
  if (locItems.length === 0) return { items: [], gold: [] }

  const picked = locItems[Math.floor(Math.random() * locItems.length)]
  const fallbackRarity = outcome === 'critical' ? 'raro' : outcome === 'success' ? 'incomum' : 'comum'
  const targetCharId = characterId ?? ctx.characters[0]?.id

  if (!targetCharId) return { items: [], gold: [] }

  return {
    items: [{
      characterId: targetCharId,
      item: {
        id: `gen-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: picked.name,
        type: picked.type || 'ferramenta',
        rarity: fallbackRarity,
        description: picked.description || 'Um item encontrado durante a aventura.',
        narrativeEffect: picked.narrativeEffect || '',
        usageContext: 'passivo',
        bonus: {},
        difficultyReduction: 0,
        hpRestore: 0,
        sellPrice: 5,
        consumable: false,
        equippable: false,
        stackable: false,
      },
      quantity: 1,
    }],
    gold: [],
  }
}
