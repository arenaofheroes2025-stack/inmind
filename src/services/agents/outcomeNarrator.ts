/**
 * Outcome Narrator Agent — AI that narrates what happened after a dice roll.
 *
 * Responsibilities:
 * - Narrate the individual result of a dice roll for a specific action
 * - Respect dice outcomes as absolute law (fail = failure, success = success)
 * - Produce concise, direct narrative text (150-350 chars)
 * - Apply proportionality: difficulty tier × consequence magnitude
 *
 * This agent does NOT: produce narrative tags, generate items/gold, advance the plot,
 * handle reputation, or create choices. It receives the scene (with tags) as context only.
 */

import type { NarrativeContext, OutcomeNarrative } from './shared'
import {
  buildWorldContext,
  buildLocationContext,
  buildPartyContext,
  buildOwnedItemsContext,
  extractContent,
  parseJsonPayload,
} from './shared'
import type { Choice, RollOutcome } from '../../systems/narrative'
import { createChatCompletion } from '../aiClient'

/* ──────────────────────────────────────────────
   System Prompt — Outcome Narrator
   ────────────────────────────────────────────── */

const OUTCOME_SYSTEM_PROMPT =
  'Voce e o MESTRE DE RPG que narra o resultado INDIVIDUAL de uma acao apos a rolagem de dados.\n' +
  '\n' +
  'REGRA INVIOLAVEL — RESULTADO DOS DADOS:\n' +
  'O resultado do dado e LEI ABSOLUTA. NUNCA contradiga o resultado da rolagem.\n' +
  '- FALHA ou FALHA CRITICA = a acao DEU ERRADO. Narre FRACASSO, consequencias negativas, planos que falharam. PROIBIDO narrar sucesso disfarçado.\n' +
  '- SUCESSO ou SUCESSO CRITICO = a acao funcionou. Narre conquista, avanco, resultado positivo.\n' +
  '- SUCESSO PARCIAL = funcionou parcialmente, com custo ou complicacao.\n' +
  '- Se o jogador tentou convencer alguem e FALHOU, a pessoa NAO foi convencida. Se tentou abrir uma porta e FALHOU, a porta NAO abriu.\n' +
  '- PROIBIDO: narrar que o jogador "conseguiu" algo quando o dado diz FALHA. PROIBIDO: amenizar falhas como se fossem sucessos parciais.\n' +
  '\n' +
  'Estilo:\n' +
  '- Linguagem PRATICA e CINEMATOGRAFICA: frases curtas, ritmo agil.\n' +
  '- NUNCA use a palavra "NPC". Refira-se a personagens pelo nome ou funcao.\n' +
  '- Esta narracao e CONCISA — apenas o resultado imediato da acao.\n' +
  '- NAO avance a trama geral. NAO introduza novos arcos ou reviravoltas.\n' +
  '- NAO use tags narrativas como [choice:], [npc:], [item:] etc na saida.\n' +
  '- Toda narrativa DEVE ser em PORTUGUES DO BRASIL.\n' +
  '\n' +
  'REGRAS RIGIDAS:\n' +
  '1. Responda APENAS com JSON valido. Sem markdown, sem comentarios, sem texto fora do JSON.\n' +
  '2. Siga EXATAMENTE o schema fornecido. Nao adicione campos extras. Nao omita campos.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const OUTCOME_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA para resultados (siga EXATAMENTE):
{
  "text": string,          // narrativa do resultado em 1-3 paragrafos. Use \\n para separar.
  "consequence": string    // resumo de 1 frase do que mudou
}
`

/* ──────────────────────────────────────────────
   Fallback
   ────────────────────────────────────────────── */

function buildFallbackOutcome(
  choice: Choice,
  outcome: RollOutcome,
): OutcomeNarrative {
  const outcomeTexts: Record<RollOutcome, string> = {
    'critical-fail':
      'Uma falha catastrofica. As consequencias serao sentidas por muito tempo.',
    fail: 'A tentativa falha. O mundo reage contra voce, e obstaculos surgem.',
    partial:
      'Um sucesso parcial — voce consegue algo, mas a um custo inesperado.',
    success:
      'Sucesso! A acao se desenrola como planejado, abrindo novas possibilidades.',
    critical:
      'Um triunfo absoluto! O destino sorri e portas antes trancadas se escancararam.',
  }

  return {
    text: `${choice.description} — ${outcomeTexts[outcome]}`,
    consequence: outcomeTexts[outcome],
  }
}

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Generate narrative reaction to a dice roll outcome for a chosen action.
 * Returns only { text, consequence } — no items, no reputation, no gold.
 */
export async function narrateOutcome(
  ctx: NarrativeContext,
  choice: Choice,
  outcome: RollOutcome,
  rollTotal: number,
  characterName?: string,
  sceneDescription?: string,
): Promise<OutcomeNarrative> {
  const { world, location, content, characters, activeQuestIds, equipmentMap } = ctx
  const difficultyTier = choice.difficulty >= 15 ? 'ALTA' : choice.difficulty >= 10 ? 'MEDIA' : 'BAIXA'
  const outcomeLabel: Record<RollOutcome, string> = {
    'critical-fail': 'FALHA CRITICA (1 natural)',
    fail: 'FALHA',
    partial: 'SUCESSO PARCIAL',
    success: 'SUCESSO',
    critical: 'SUCESSO CRITICO (20 natural)',
  }

  const userPrompt =
    buildWorldContext(world, location.id) +
    '\n\n' +
    buildLocationContext(location, content, activeQuestIds) +
    '\n\n' +
    buildPartyContext(characters, equipmentMap) +
    buildOwnedItemsContext(characters, equipmentMap) +
    '\n\n' +
    (sceneDescription
      ? `CENA ATUAL (o que foi narrado ate agora — use como contexto para coerencia):\n"${sceneDescription.slice(0, 1500)}"\n\n`
      : '') +
    `Acao escolhida: "${choice.description}"\n` +
    (characterName
      ? `PERSONAGEM RESPONSAVEL PELA ACAO: ${characterName}\n`
      : '') +
    `Atributo testado: ${choice.primaryAttribute}\n` +
    `Dificuldade: ${choice.difficulty} (nivel: ${difficultyTier})\n` +
    `Resultado da rolagem: ${rollTotal} → ${outcomeLabel[outcome]}\n` +
    '\n=== REGRA #1 (MAIS IMPORTANTE DE TODAS) ===\n' +
    `O resultado do dado e: ${outcomeLabel[outcome]}.\n` +
    (outcome === 'fail' || outcome === 'critical-fail'
      ? '>>> A acao FALHOU. A narrativa OBRIGATORIAMENTE deve mostrar FRACASSO. <<<\n' +
        '>>> O personagem NAO conseguiu o que queria. Algo deu ERRADO. <<<\n' +
        '>>> PROIBIDO: narrar que "conseguiu", "obteve sucesso", "alcancou", "convenceu", "abriu". <<<\n' +
        '>>> OBRIGATORIO: narrar que "falhou", "nao conseguiu", "tropecou", "errou", "foi impedido". <<<\n'
      : outcome === 'partial'
        ? '>>> Sucesso PARCIAL — conseguiu algo, mas com custo, complicacao ou resultado incompleto. <<<\n'
        : '>>> SUCESSO — a acao funcionou! Narre conquista e resultado positivo. <<<\n') +
    '===========================================\n' +
    '\nTAREFA: Narre o RESULTADO desta acao de forma OBJETIVA e CONCISA.\n' +
    'IMPORTANTE: Esta e apenas a narracao do resultado INDIVIDUAL de uma acao. A narrativa principal da historia sera gerada DEPOIS, quando todos os jogadores tiverem resolvido suas acoes. Portanto:\n' +
    '- Seja DIRETO: descreva o que aconteceu com o personagem em poucas frases.\n' +
    '- NAO avance a trama geral. NAO introduza novos arcos ou reviravoltas.\n' +
    '- Foque APENAS no resultado imediato da acao: o que o personagem fez, o que deu certo/errado, e a reacao imediata do ambiente.\n' +
    (characterName
      ? `- OBRIGATORIO: Use o NOME "${characterName}" na narrativa. Refira-se a ${characterName} pelo nome, NAO use "voce". Ex: "${characterName} avanca...", "${characterName} tropeca..."\n` +
        `- ${characterName} e o PROTAGONISTA desta cena. Descreva as acoes, reacoes e consequencias focando neste personagem\n`
      : '') +
    '- Descreva o que acontece como consequencia DIRETA do resultado do dado\n' +
    '- PROPORCIONALIDADE (REGRA CRITICA): As consequencias devem ser PROPORCIONAIS a dificuldade:\n' +
    `  * Esta acao tem dificuldade ${difficultyTier} (${choice.difficulty}).\n` +
    '  * Dificuldade ALTA (15-20): sucesso = grande recompensa/revelacao. Falha = consequencia grave, perigo real.\n' +
    '  * Dificuldade MEDIA (10-14): sucesso = avanco claro. Falha = complicacao moderada.\n' +
    '  * Dificuldade BAIXA (5-9): sucesso = ganho incremental. Falha = contratempo leve.\n' +
    '  * Criticos amplificam: falha critica em dificuldade alta = catastrofe. Sucesso critico em dificuldade alta = feito lendario.\n' +
    '- REGRA CRITICA: Se o resultado e FALHA, a narrativa DEVE mostrar fracasso REAL. Se e SUCESSO, deve mostrar conquista REAL. NUNCA inverta ou amenize.\n' +
    '- NUNCA use a palavra "NPC". Refira-se a personagens pelo nome ou funcao. So introduza personagens se fizerem sentido para a historia/ato/missao atual.\n' +
    '- Mantenha tom dramatico e envolvente\n' +
    '- NAO use tags narrativas como [npc:], [item:], [choice:], etc na saida. Apenas prosa pura.\n' +
    '- O campo "consequence" deve descrever CONCRETAMENTE o que mudou no mundo: quem saiu, o que apareceu, o que foi revelado, o que se fechou/abriu\n' +
    '- LIMITE: text entre 150 e 350 caracteres. Seja conciso — o avanco da historia acontece na narrativa principal, nao aqui.\n\n' +
    OUTCOME_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: OUTCOME_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 1000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<OutcomeNarrative>(raw)

    if (parsed?.text && parsed?.consequence) {
      return parsed
    }

    console.warn('[OutcomeNarrator] Invalid outcome response, using fallback. Raw:', raw?.slice(0, 500))
  } catch (err) {
    console.error('[OutcomeNarrator] Outcome narration failed:', err)
  }

  return buildFallbackOutcome(choice, outcome)
}
