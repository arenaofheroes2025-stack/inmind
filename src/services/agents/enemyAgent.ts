/**
 * Enemy Detail Agent — generates full Enemy stats on demand.
 *
 * Called when the player encounters an enemy in combat.
 * Takes the lightweight EnemySummary + world/location context and produces
 * a complete Enemy object with HP, behavior, attack patterns, and drops.
 */

import type { Enemy, BattleAttributes, EnemyAIPattern } from '../../data/types'
import type { NarrativeContext } from './shared'
import {
  buildWorldContext,
  buildLocationContext,
  extractContent,
  parseJsonPayload,
} from './shared'
import { createChatCompletion } from '../aiClient'
import { getSkillsForCharacter } from '../../data/battleSkills'

/* ──────────────────────────────────────────────
   System Prompt
   ────────────────────────────────────────────── */

const ENEMY_SYSTEM_PROMPT =
  'Voce e um gerador de inimigos detalhados para um RPG narrativo imersivo.\n' +
  'Receba o resumo de um inimigo e gere seus detalhes completos de combate.\n' +
  'Regras:\n' +
  '- Responda APENAS com JSON valido. Sem markdown.\n' +
  '- Siga EXATAMENTE o schema fornecido.\n' +
  '- Todo conteudo DEVE ser em PORTUGUES DO BRASIL.\n' +
  '- HP deve ser proporcional ao nivel de perigo do local (perigo 1-3: 10-25 HP, 4-6: 20-40 HP, 7-10: 35-60 HP).\n' +
  '- Crie padroes de ataque unicos e interessantes.\n' +
  '- Drops devem ser coerentes com o inimigo e o local.\n' +
  '- Drops referenciam ids de itens do local quando possivel.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const ENEMY_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA:
{
  "enemy": {
    "id": string,             // MESMO id fornecido
    "name": string,           // MESMO nome fornecido
    "hp": number,             // pontos de vida (10-60, proporcional ao perigo)
    "maxHp": number,          // HP maximo (mesmo valor que hp)
    "level": number,          // nivel do inimigo (1-10, baseado no perigo do local)
    "behavior": string,       // 1-2 frases sobre como age em combate
    "attackPattern": string,  // 1-2 frases sobre padrao de ataque (ataques especificos, fraquezas)
    "aiPattern": string,      // UM de: "agressivo", "defensivo", "tatico", "covarde"
    "battleAttributes": {
      "velocidade": number,   // 5-20
      "ataque": number,       // 5-25
      "defesa": number,       // 3-20
      "magia": number         // 3-20
    },
    "drops": [                // 1-3 drops possiveis
      {
        "id": string,         // formato: "{enemyId}-drop-{n}"
        "itemId": string,     // id de um item do local OU "gen-{nome}" para item novo
        "chance": number      // probabilidade 0.0 a 1.0
      }
    ]
  }
}
`

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

export async function generateEnemyDetails(
  enemyId: string,
  ctx: NarrativeContext,
): Promise<Enemy | null> {
  const summary = ctx.content.enemies.find((e) => e.id === enemyId)
  if (!summary) return null

  const itemIds = ctx.content.items.map((it) => it.id)

  const userPrompt =
    buildWorldContext(ctx.world, ctx.location.id) +
    '\n' +
    buildLocationContext(ctx.location, ctx.content, ctx.activeQuestIds) +
    '\n\nInimigo a detalhar:\n' +
    `  ID: ${summary.id}\n` +
    `  Nome: ${summary.name}\n` +
    `  Descricao: ${summary.description}\n` +
    (summary.narrativeEffect ? `  Efeito narrativo: ${summary.narrativeEffect}\n` : '') +
    `\nNivel de perigo do local: ${ctx.location.dangerLevel}/10\n` +
    `Itens do local (ids para drops): ${JSON.stringify(itemIds)}\n` +
    ENEMY_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: ENEMY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 2000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<{ enemy: Enemy }>(raw)

    if (parsed?.enemy) {
      const e = parsed.enemy
      const level = Number(e.level) || Math.max(1, Math.ceil((ctx.location.dangerLevel ?? 3) / 2))
      const hp = Number(e.hp) || 20
      const aiPattern: EnemyAIPattern = (['agressivo', 'defensivo', 'tatico', 'covarde'] as const).includes(e.aiPattern as EnemyAIPattern)
        ? (e.aiPattern as EnemyAIPattern)
        : 'agressivo'

      const battleAttrs: BattleAttributes = e.battleAttributes
        ? {
            velocidade: Number(e.battleAttributes.velocidade) || 8,
            ataque: Number(e.battleAttributes.ataque) || 8,
            defesa: Number(e.battleAttributes.defesa) || 5,
            magia: Number(e.battleAttributes.magia) || 5,
          }
        : generateFallbackBattleAttrs(ctx.location.dangerLevel ?? 3)

      // Generate enemy skills based on archetype-like pattern
      const archetypeForSkills = inferArchetypeFromBehavior(e.behavior || summary.description, aiPattern)
      const skills = getSkillsForCharacter(archetypeForSkills, level).slice(0, 3) // enemies get max 3 skills

      return {
        id: summary.id,
        name: summary.name,
        hp,
        maxHp: Number(e.maxHp) || hp,
        level,
        behavior: e.behavior || summary.description,
        attackPattern: e.attackPattern || 'Ataque padrao.',
        drops: Array.isArray(e.drops) ? e.drops : [],
        battleAttributes: battleAttrs,
        skills,
        aiPattern,
      }
    }

    console.warn('[EnemyAgent] Invalid response')
  } catch (err) {
    console.error('[EnemyAgent] Failed:', err)
  }

  // Fallback: minimal Enemy from summary
  const baseDanger = ctx.location.dangerLevel ?? 3
  const fallbackLevel = Math.max(1, Math.ceil(baseDanger / 2))
  const fallbackHp = 10 + baseDanger * 4
  return {
    id: summary.id,
    name: summary.name,
    hp: fallbackHp,
    maxHp: fallbackHp,
    level: fallbackLevel,
    behavior: summary.description,
    attackPattern: 'Ataque corpo a corpo direto.',
    drops: [],
    battleAttributes: generateFallbackBattleAttrs(baseDanger),
    skills: getSkillsForCharacter('guerreiro', fallbackLevel).slice(0, 2),
    aiPattern: 'agressivo' as EnemyAIPattern,
  }
}

/* ──────────────────────────────────────────────
   Battle Helpers
   ────────────────────────────────────────────── */

function generateFallbackBattleAttrs(dangerLevel: number): BattleAttributes {
  const base = 3 + dangerLevel
  return {
    velocidade: base + Math.floor(Math.random() * 4),
    ataque: base + Math.floor(Math.random() * 5),
    defesa: Math.max(2, base - 1 + Math.floor(Math.random() * 3)),
    magia: Math.max(2, base - 2 + Math.floor(Math.random() * 4)),
  }
}

/** Infer an archetype for skill generation based on enemy behavior/pattern */
function inferArchetypeFromBehavior(behavior: string, aiPattern: EnemyAIPattern): string {
  const lower = behavior.toLowerCase()
  if (lower.includes('magi') || lower.includes('feitic') || lower.includes('arcano') || lower.includes('elemen')) return 'mago'
  if (lower.includes('cur') || lower.includes('sagr') || lower.includes('divino')) return 'clerigo'
  if (lower.includes('furt') || lower.includes('veneno') || lower.includes('sombr') || lower.includes('assass')) return 'ladino'
  if (lower.includes('flecha') || lower.includes('arco') || lower.includes('distanc') || lower.includes('caçad')) return 'ranger'
  if (aiPattern === 'covarde') return 'ladino'
  if (aiPattern === 'tatico') return 'mago'
  if (aiPattern === 'defensivo') return 'guerreiro'
  return 'guerreiro'
}
