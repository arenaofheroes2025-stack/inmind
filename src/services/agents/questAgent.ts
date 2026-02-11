/**
 * Quest Detail Agent — generates full Quest details on demand.
 *
 * Called when the player accepts or interacts with a quest from the location summary.
 * Takes the lightweight QuestSummary + world/location context and produces
 * a complete Quest object with linked acts, rewards, and impact.
 */

import type { Quest } from '../../data/types'
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

const QUEST_SYSTEM_PROMPT =
  'Voce e um gerador de quests detalhadas para um RPG narrativo imersivo.\n' +
  'Receba o resumo de uma quest e gere seus detalhes completos.\n' +
  'Regras:\n' +
  '- Responda APENAS com JSON valido. Sem markdown.\n' +
  '- Siga EXATAMENTE o schema fornecido.\n' +
  '- Todo conteudo DEVE ser em PORTUGUES DO BRASIL.\n' +
  '- Quests principais devem linkar aos atos do mundo.\n' +
  '- Rewards devem ser proporcionais ao tipo e dificuldade da quest.\n' +
  '- Impact deve descrever como completar a quest afeta a historia.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const QUEST_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA:
{
  "quest": {
    "id": string,             // MESMO id fornecido
    "title": string,          // MESMO titulo fornecido
    "type": string,           // MESMO tipo fornecido ("main"|"side"|"ambient")
    "description": string,    // descricao expandida (3-5 frases com detalhes da missao)
    "linkedActIds": [string], // ids dos atos do mundo relacionados ([] para ambient/side sem link)
    "rewards": [              // 1-3 recompensas
      {
        "id": string,         // formato: "{questId}-reward-{n}"
        "type": string,       // VALORES: "xp" | "item" | "moeda"
        "amount": number      // quantidade: xp=50-200, moeda=10-100, item=1
      }
    ],
    "impact": string          // 2-3 frases sobre como completar a quest afeta a historia e o mundo
  }
}
`

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

export async function generateQuestDetails(
  questId: string,
  ctx: NarrativeContext,
): Promise<Quest | null> {
  // Search in all quest categories
  const allSummaries = [
    ...ctx.content.quests.main,
    ...ctx.content.quests.side,
    ...ctx.content.quests.ambient,
  ]
  const summary = allSummaries.find((q) => q.id === questId)
  if (!summary) return null

  const actIds = ctx.world.acts.map((a) => a.id)

  const userPrompt =
    buildWorldContext(ctx.world, ctx.location.id) +
    '\n' +
    buildLocationContext(ctx.location, ctx.content, ctx.activeQuestIds) +
    '\n\nQuest a detalhar:\n' +
    `  ID: ${summary.id}\n` +
    `  Titulo: ${summary.title}\n` +
    `  Tipo: ${summary.type}\n` +
    `  Descricao: ${summary.description}\n` +
    (summary.narrativeEffect ? `  Efeito narrativo: ${summary.narrativeEffect}\n` : '') +
    `\nAtos do mundo (ids para linkedActIds): ${JSON.stringify(actIds)}\n` +
    QUEST_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: QUEST_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 2000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<{ quest: Quest }>(raw)

    if (parsed?.quest) {
      const q = parsed.quest
      return {
        id: summary.id,
        title: summary.title,
        type: summary.type,
        description: q.description || summary.description,
        linkedActIds: Array.isArray(q.linkedActIds) ? q.linkedActIds : [],
        rewards: Array.isArray(q.rewards) ? q.rewards : [],
        impact: q.impact || summary.narrativeEffect || '',
      }
    }

    console.warn('[QuestAgent] Invalid response')
  } catch (err) {
    console.error('[QuestAgent] Failed:', err)
  }

  // Fallback: minimal Quest from summary
  return {
    id: summary.id,
    title: summary.title,
    type: summary.type,
    description: summary.description,
    linkedActIds: [],
    rewards: [{ id: `${summary.id}-reward-xp`, type: 'xp', amount: 100 }],
    impact: summary.narrativeEffect || 'Contribui para o progresso da aventura.',
  }
}
