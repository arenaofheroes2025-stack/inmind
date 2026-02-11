/**
 * Action Validator Agent — AI that validates player actions and assigns mechanics.
 *
 * Responsibilities:
 * - Receive free-text player actions and the current scene (with tags) as context
 * - Validate whether each action makes sense in the narrative context
 * - Assign primary attribute, difficulty (5-20), and risk level
 * - Determine whether the action affects inventory (items/gold)
 *
 * This agent does NOT: narrate, produce tags, handle dice, or generate items.
 * It receives the scene text (which may contain tags) purely as context.
 */

import type { NarrativeContext, CustomActionInput, ValidatedAction } from './shared'
import {
  buildWorldContext,
  buildLocationContext,
  extractContent,
  parseJsonPayload,
} from './shared'
import { createChatCompletion } from '../aiClient'

/* ──────────────────────────────────────────────
   System Prompt — Action Validator
   ────────────────────────────────────────────── */

const VALIDATOR_SYSTEM_PROMPT =
  'Voce e um validador de acoes de RPG. Analise as acoes dos jogadores no contexto da CENA ATUAL e dos RESULTADOS ANTERIORES. ' +
  'Atribua dificuldades JUSTAS e VARIADAS (5-20), nao padronize tudo como 12. ' +
  'Leve em conta: o alvo da interacao, o momento da historia, o arquetipo do personagem e os resultados anteriores. ' +
  'Se a acao NAO faz sentido no contexto, marque como invalida. Responda APENAS com JSON valido.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const VALIDATION_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA para validacao de acoes (siga EXATAMENTE):
{
  "actions": [
    {
      "characterId": string,    // ID do personagem (copie exatamente do input)
      "valid": boolean,         // true se a acao faz sentido no contexto, false se nao
      "reason": string,         // explicacao curta de porque e valida ou invalida
      "description": string,    // descricao narrativa refinada da acao (se valida)
      "primaryAttribute": string, // VALORES PERMITIDOS: "forca" | "agilidade" | "intelecto" | "carisma" | "vontade" | "percepcao"
      "difficulty": number,     // inteiro entre 5 (facil) e 20 (quase impossivel) — VARIE conforme contexto
      "riskLevel": string,      // VALORES PERMITIDOS: "low" | "medium" | "high"
      "affectsInventory": boolean   // true SOMENTE se a acao pode resultar em obter/perder itens, ouro, ou envolve comercio/saque/busca de objetos
    }
  ]
}
`

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Validate custom player actions against the current narrative context.
 * Returns validated actions with assigned attributes and difficulty.
 */
export async function validateActions(
  ctx: NarrativeContext,
  actions: CustomActionInput[],
  sceneDescription?: string,
  previousOutcomesSummary?: string,
): Promise<ValidatedAction[]> {
  const { world, location, content, characters, activeQuestIds } = ctx

  const actionsText = actions
    .map(
      (a) =>
        `  - Personagem: ${a.characterName} (ID: ${a.characterId})\n    Acao: "${a.actionText}"`,
    )
    .join('\n')

  const partyInfo = characters
    .map((c) => {
      const attrs =
        `Forca:${c.actionAttributes.forca} Agilidade:${c.actionAttributes.agilidade}` +
        ` Intelecto:${c.actionAttributes.intelecto} Carisma:${c.actionAttributes.carisma}` +
        ` Vontade:${c.actionAttributes.vontade} Percepcao:${c.actionAttributes.percepcao}`
      return `  - ${c.name} (${c.archetype}): ${attrs}`
    })
    .join('\n')

  const userPrompt =
    buildWorldContext(world, location.id) +
    '\n\n' +
    buildLocationContext(location, content, activeQuestIds) +
    '\n\n' +
    (sceneDescription
      ? `CENA ATUAL (narrativa que os jogadores estao vendo):\n${sceneDescription.slice(0, 600)}\n\n`
      : '') +
    (previousOutcomesSummary
      ? `RESULTADOS ANTERIORES (o que ja aconteceu nesta rodada/cena):\n${previousOutcomesSummary}\n\n`
      : '') +
    `Personagens do grupo:\n${partyInfo}\n\n` +
    `ACOES LIVRES dos jogadores:\n${actionsText}\n\n` +
    'TAREFA: Valide CADA acao e atribua a dificuldade CORRETA.\n\n' +
    'REGRAS DE INVENTARIO (campo "affectsInventory"):\n' +
    '- Marque affectsInventory = true quando a acao pode resultar em OBTER ou PERDER itens fisicos, tesouros, ouro. ' +
    'Exemplos: investigar um bau, pegar um objeto, comerciar com mercador, saquear um inimigo, ' +
    'receber recompensa de NPC, encontrar algo escondido, comprar/vender, abrir tesouro, coletar ingredientes.\n' +
    '- Marque affectsInventory = true tambem quando interagir com tags [item:] (objetos no cenario).\n' +
    '- Marque affectsInventory = false para acoes puramente sociais (conversar sem comercio), ' +
    'explorar sem buscar objetos, combate puro, acoes mentais, movimentacao simples.\n' +
    '- Se o jogador interage com um [item:] tag, affectsInventory = true OBRIGATORIAMENTE.\n' +
    '- Se o jogador tenta comprar algo ou comerciar, affectsInventory = true.\n\n' +
    'REGRAS DE DIFICULDADE (d20, escala 1-20):\n' +
    '- 5-7: FACIL — acoes simples, alvos cooperativos, situacoes sem pressao, inicio da aventura\n' +
    '- 8-10: MODERADA — acoes comuns de aventura, algum desafio mas realista\n' +
    '- 11-13: DESAFIADORA — requer habilidade, alvos hostis ou cautelosos\n' +
    '- 14-16: DIFICIL — acoes arriscadas, inimigos poderosos, situacoes criticas\n' +
    '- 17-19: MUITO DIFICIL — feitos heroicos, adversarios superiores\n' +
    '- 20: QUASE IMPOSSIVEL — apenas em situacoes extremas\n\n' +
    'FATORES QUE INFLUENCIAM A DIFICULDADE:\n' +
    '- O ALVO da interacao: NPCs amigaveis = facil, inimigos = dificil, objetos simples = facil\n' +
    '- Coerencia acao-personagem: acao alinhada com o arquetipo/atributos = reduz dificuldade\n' +
    '- Momento da historia: inicio = mais facil, climax = mais dificil\n' +
    '- Historico de acoes: se os resultados anteriores mostram muitos fracassos, NAO aumente mais a dificuldade — mantenha justa\n' +
    '- Se a acao avanca objetivos principais da narrativa de forma criativa, FACILITE levemente\n' +
    '- Acoes triviais/cotidianas devem ter dificuldade BAIXA (5-8)\n\n' +
    'NAO coloque tudo como dificuldade 12. VARIE de acordo com o contexto real.\n\n' +
    'Para CADA acao determine:\n' +
    '1. Se faz sentido no contexto atual\n' +
    '2. Qual atributo principal seria testado\n' +
    '3. A dificuldade JUSTA (5-20) considerando TODOS os fatores acima\n' +
    '4. O nivel de risco (low/medium/high)\n' +
    '5. Refine a descricao da acao de forma narrativa\n\n' +
    'IMPORTANTE: Responda APENAS com JSON valido.\n' +
    VALIDATION_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: VALIDATOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 1500,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<{ actions: ValidatedAction[] }>(raw)

    if (parsed?.actions && Array.isArray(parsed.actions)) {
      const validAttributes = [
        'forca', 'agilidade', 'intelecto', 'carisma', 'vontade', 'percepcao',
      ]
      return parsed.actions.map((a) => ({
        characterId: a.characterId,
        characterName:
          a.characterName ??
          actions.find((inp) => inp.characterId === a.characterId)?.characterName ??
          'Aventureiro',
        valid: Boolean(a.valid),
        reason: a.reason ?? '',
        description: a.description ?? '',
        primaryAttribute: validAttributes.includes(a.primaryAttribute)
          ? a.primaryAttribute
          : 'percepcao',
        difficulty: Math.max(5, Math.min(20, a.difficulty || 12)),
        riskLevel: (['low', 'medium', 'high'] as const).includes(a.riskLevel)
          ? a.riskLevel
          : 'medium',
        affectsInventory: Boolean(a.affectsInventory),
      }))
    }

    console.warn('[ActionValidator] Invalid validation response')
  } catch (err) {
    console.error('[ActionValidator] Custom action validation failed:', err)
  }

  // Fallback: accept all actions with default values
  return actions.map((a) => ({
    characterId: a.characterId,
    characterName: a.characterName,
    valid: true,
    reason: 'Validacao automatica (fallback)',
    description: a.actionText,
    primaryAttribute: 'percepcao',
    difficulty: 12,
    riskLevel: 'medium' as const,
    affectsInventory: false,
  }))
}
