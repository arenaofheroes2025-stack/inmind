/**
 * Battle Narrator — Hybrid narration system.
 *
 * Template-based narration:
 *   Fast, zero-cost, used for every action in battle (attacks, skills, movement, etc.)
 *   Each action type has 3-5 Portuguese template variants chosen at random.
 *
 * AI-powered narration (calls createChatCompletion):
 *   Used ONLY for epic moments to save API costs:
 *   - Battle intro (when combat begins)
 *   - Battle conclusion (victory or defeat)
 *   - Dice roll moments (dramatic d20 rolls)
 */

import { createChatCompletion } from '../aiClient'
import type {
  BattleLogEntry,
  BattleState,
  World,
  Location,
} from '../../data/types'

/* ══════════════════════════════════════════════
   Template-based narration
   ══════════════════════════════════════════════ */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Replace {actor}, {target}, {damage}, {healing}, {skill}, {effect} in templates */
function fill(template: string, vars: Record<string, string | number | undefined>): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    if (val != null) result = result.replaceAll(`{${key}}`, String(val))
  }
  return result
}

/* ── Attack ── */
const ATTACK_TEMPLATES = [
  '{actor} avança e desfere um golpe certeiro em {target}, causando {damage} de dano!',
  '{actor} ataca {target} com ferocidade — {damage} de dano!',
  'Com um movimento rápido, {actor} acerta {target} causando {damage} de dano!',
  '{actor} investe contra {target}! O golpe conecta e causa {damage} de dano.',
  'O ataque de {actor} atinge {target} em cheio — {damage} pontos de dano!',
]

const ATTACK_KILL_TEMPLATES = [
  '{actor} desfere o golpe final em {target} — {damage} de dano! {target} cai derrotado!',
  'Com um ataque devastador, {actor} elimina {target}! ({damage} de dano)',
  '{actor} acaba com {target} de uma vez! {damage} de dano e o inimigo não se levanta mais.',
]

/* ── Defend ── */
const DEFEND_TEMPLATES = [
  '{actor} ergue a guarda e se prepara para o próximo ataque.',
  '{actor} assume postura defensiva, endurecendo sua defesa.',
  '{actor} se abaixa e levanta o escudo, pronto para absorver impactos.',
  'Com respiração firme, {actor} se concentra em sua defesa.',
]

/* ── Skill ── */
const SKILL_DAMAGE_TEMPLATES = [
  '{actor} canaliza {skill} contra {target} — {damage} de dano!',
  'A habilidade {skill} de {actor} atinge {target} causando {damage} de dano!',
  '{actor} usa {skill}! {target} sofre {damage} de dano.',
  'Com maestria, {actor} executa {skill} em {target} — {damage} pontos de dano!',
]

const SKILL_HEAL_TEMPLATES = [
  '{actor} usa {skill} em {target}, restaurando {healing} pontos de vida!',
  'A energia de {skill} flui de {actor} para {target} — +{healing} HP!',
  '{actor} canaliza {skill}! {target} recupera {healing} de vida.',
  'Com um gesto suave, {actor} aplica {skill} em {target}. +{healing} HP.',
]

const SKILL_BUFF_TEMPLATES = [
  '{actor} usa {skill}! Uma aura protetora envolve seus aliados.',
  '{actor} ativa {skill} — o grupo sente o poder crescer.',
  'A habilidade {skill} de {actor} fortalece a equipe!',
]

const SKILL_DEBUFF_TEMPLATES = [
  '{actor} usa {skill} contra {target}! Seus atributos são reduzidos.',
  '{actor} lança {skill} sobre {target} — uma fraqueza toma conta.',
  'A habilidade {skill} de {actor} diminui as forças de {target}!',
]

const SKILL_CONTROL_TEMPLATES = [
  '{actor} usa {skill} em {target}! O alvo fica imobilizado.',
  '{actor} executa {skill} — {target} perde o controle.',
  'Com precisão, {actor} aplica {skill} contra {target}!',
]

/* ── Status applied (reserved for future narration use) ── */
// const STATUS_APPLIED_TEMPLATES = [
//   '{target} recebe o efeito {effect}!',
//   'O efeito {effect} se aplica a {target}.',
//   '{target} agora está sob efeito de {effect}.',
// ]

/* ── DoT ── */
const DOT_TEMPLATES = [
  '{actor} sofre {damage} de dano de {effect}.',
  'O efeito {effect} causa {damage} de dano a {actor}.',
  '{actor} sente os efeitos de {effect} — {damage} de dano.',
]

/* ── HoT ── */
const HOT_TEMPLATES = [
  '{actor} recupera {healing} HP com {effect}.',
  'O efeito {effect} restaura {healing} de vida para {actor}.',
  '{actor} se recupera — {effect} cura {healing} HP.',
]

/* ── Move ── */
const MOVE_TEMPLATES = [
  '{actor} se reposiciona no campo de batalha.',
  '{actor} avança para uma nova posição.',
  '{actor} recua strategicamente.',
  '{actor} se movimenta pelo terreno.',
]

/* ── Flee ── */
const FLEE_SUCCESS_TEMPLATES = [
  '{actor} encontra uma abertura e escapa da batalha!',
  '{actor} foge do combate a toda velocidade!',
  'Com agilidade, {actor} escapa do confronto!',
]

const FLEE_FAIL_TEMPLATES = [
  '{actor} tenta fugir, mas os inimigos bloqueiam o caminho!',
  '{actor} procura uma rota de fuga sem sucesso.',
  'A fuga de {actor} é impedida — não há como escapar!',
]

/* ── Item ── */
const ITEM_TEMPLATES = [
  '{actor} usa um item para se fortalecer.',
  '{actor} recorre a um item em seu inventário.',
  '{actor} consome um item no meio da batalha.',
]

/* ── Dice Roll ── */
const DICE_CRIT_TEMPLATES = [
  '🎲 O dado gira e mostra 20! {actor} realiza um feito incrível!',
  '🎲 CRÍTICO! O d20 de {actor} mostra 20 — resultado devastador!',
  '🎲 Nat 20! {actor} supera todas as expectativas!',
]

const DICE_SUCCESS_TEMPLATES = [
  '🎲 {actor} rola {roll} contra DC {dc} — sucesso!',
  '🎲 O d20 favorece {actor}! Resultado: {roll} vs DC {dc}.',
  '🎲 {actor} supera o desafio com {roll} (DC {dc}).',
]

const DICE_FAIL_TEMPLATES = [
  '🎲 {actor} rola {roll} contra DC {dc} — falha.',
  '🎲 O dado não coopera. {actor}: {roll} vs DC {dc}.',
  '🎲 {actor} não consegue superar o desafio ({roll} vs DC {dc}).',
]

const DICE_CRITFAIL_TEMPLATES = [
  '🎲 O d20 cai em 1! {actor} sofre uma falha catastrófica!',
  '🎲 FALHA CRÍTICA! {actor} rola 1 — um desastre!',
  '🎲 Nat 1! Tudo que poderia dar errado para {actor}, deu.',
]

/* ──────────────────────────────────────────────
   Template Narrator (public API)
   ────────────────────────────────────────────── */

/**
 * Generate narrative text for a battle log entry using templates.
 * Returns a more colorful version of the log text.
 */
export function narrateLogEntry(entry: BattleLogEntry): string {
  const vars = {
    actor: entry.actorName,
    target: entry.targetName,
    damage: entry.damage,
    healing: entry.healing,
    skill: entry.skillName,
    effect: entry.statusApplied,
  }

  switch (entry.actionType) {
    case 'attack':
      if (entry.isKill) return fill(pick(ATTACK_KILL_TEMPLATES), vars)
      return fill(pick(ATTACK_TEMPLATES), vars)

    case 'defend':
      return fill(pick(DEFEND_TEMPLATES), vars)

    case 'skill':
      if (entry.damage && entry.damage > 0) return fill(pick(SKILL_DAMAGE_TEMPLATES), vars)
      if (entry.healing && entry.healing > 0) return fill(pick(SKILL_HEAL_TEMPLATES), vars)
      if (entry.statusApplied) {
        // Check the type from effect name (heuristic)
        if (entry.statusApplied.includes('+')) return fill(pick(SKILL_BUFF_TEMPLATES), vars)
        if (entry.statusApplied.includes('-')) return fill(pick(SKILL_DEBUFF_TEMPLATES), vars)
        return fill(pick(SKILL_CONTROL_TEMPLATES), vars)
      }
      return fill(pick(SKILL_DAMAGE_TEMPLATES), vars)

    case 'dot':
      return fill(pick(DOT_TEMPLATES), vars)

    case 'hot':
      return fill(pick(HOT_TEMPLATES), vars)

    case 'move':
      return fill(pick(MOVE_TEMPLATES), vars)

    case 'flee':
      // Heuristic: if battle ended, it was successful
      return entry.text.includes('foge')
        ? fill(pick(FLEE_SUCCESS_TEMPLATES), vars)
        : fill(pick(FLEE_FAIL_TEMPLATES), vars)

    case 'item':
      return fill(pick(ITEM_TEMPLATES), vars)

    case 'dice':
      if (entry.isCrit) return fill(pick(DICE_CRIT_TEMPLATES), vars)
      if (entry.text.includes('FALHA CRÍTICA')) return fill(pick(DICE_CRITFAIL_TEMPLATES), vars)
      if (entry.text.includes('sucesso')) return fill(pick(DICE_SUCCESS_TEMPLATES), vars)
      return fill(pick(DICE_FAIL_TEMPLATES), vars)

    default:
      return entry.text
  }
}

/* ══════════════════════════════════════════════
   AI-powered narration (epic moments only)
   ══════════════════════════════════════════════ */

/** Context for AI narration calls */
export type BattleNarrativeContext = {
  world: World
  location: Location
  playerNames: string[]
  enemyNames: string[]
  /** Extra context for the specific moment */
  extraContext?: string
}

function buildBattleSystemPrompt(): string {
  return (
    'Você é o narrador de um RPG de mesa. Sua função é narrar MOMENTOS ÉPICOS de batalha.\n' +
    'Estilo: cinematográfico, conciso (2-3 parágrafos máximo), em português brasileiro.\n' +
    'Use linguagem sensorial — sons, movimentos, emoções.\n' +
    'NUNCA mencione mecânicas de jogo, números, dados ou regras.\n' +
    'NUNCA use a palavra "NPC" ou termos de sistema.\n' +
    'Narre como se fosse uma cena de filme: ação, tensão, resolução.'
  )
}

/** AI narration for the battle intro — when combat begins */
export async function narrateBattleIntro(ctx: BattleNarrativeContext): Promise<string> {
  try {
    const resp = await createChatCompletion({
      messages: [
        { role: 'system', content: buildBattleSystemPrompt() },
        {
          role: 'user',
          content:
            `Narre a ABERTURA de uma batalha em "${ctx.location.name}" no mundo "${ctx.world.title}" (${ctx.world.genre}).\n` +
            `Heróis: ${ctx.playerNames.join(', ')}.\n` +
            `Inimigos: ${ctx.enemyNames.join(', ')}.\n` +
            `${ctx.location.description ? `Cenário: ${ctx.location.description}\n` : ''}` +
            `${ctx.extraContext ? ctx.extraContext + '\n' : ''}` +
            'Descreva o momento em que os adversários se encaram. Crie tensão. 2-3 parágrafos. Sem mecânicas de jogo.',
        },
      ],
      maxCompletionTokens: 400,
      reasoningEffort: 'low',
      timeoutMs: 15000,
    })

    return resp?.trim() || fallbackIntro(ctx)
  } catch {
    return fallbackIntro(ctx)
  }
}

/** AI narration for battle conclusion */
export async function narrateBattleConclusion(
  ctx: BattleNarrativeContext,
  victory: boolean,
  highlights: string[],
): Promise<string> {
  try {
    const resp = await createChatCompletion({
      messages: [
        { role: 'system', content: buildBattleSystemPrompt() },
        {
          role: 'user',
          content: victory
            ? `Narre a VITÓRIA na batalha em "${ctx.location.name}".\n` +
              `Heróis: ${ctx.playerNames.join(', ')}.\n` +
              `Inimigos derrotados: ${ctx.enemyNames.join(', ')}.\n` +
              `Momentos marcantes: ${highlights.join('; ')}.\n` +
              'Descreva o alívio pós-combate, o campo de batalha, os heróis se recuperando. 2-3 parágrafos.'
            : `Narre a DERROTA na batalha em "${ctx.location.name}".\n` +
              `Heróis caídos: ${ctx.playerNames.join(', ')}.\n` +
              `Inimigos vitoriosos: ${ctx.enemyNames.join(', ')}.\n` +
              'Descreva a queda dos heróis, a escuridão, mas com esperança de retorno. 2 parágrafos.',
        },
      ],
      maxCompletionTokens: 400,
      reasoningEffort: 'low',
      timeoutMs: 15000,
    })

    return resp?.trim() || fallbackConclusion(ctx, victory)
  } catch {
    return fallbackConclusion(ctx, victory)
  }
}

/** AI narration for dramatic dice roll moments */
export async function narrateDiceRollMoment(
  ctx: BattleNarrativeContext,
  rollerName: string,
  roll: number,
  isCrit: boolean,
  isCritFail: boolean,
  purpose: string,
): Promise<string> {
  try {
    const resp = await createChatCompletion({
      messages: [
        { role: 'system', content: buildBattleSystemPrompt() },
        {
          role: 'user',
          content:
            `Narre o momento em que ${rollerName} lança o d20 ${isCrit ? '(CRÍTICO — rolou 20!)' : isCritFail ? '(FALHA CRÍTICA — rolou 1!)' : `(rolou ${roll})`} ` +
            `para ${purpose} na batalha em "${ctx.location.name}".\n` +
            'Descreva a tensão da rolagem e a reação imediata. 1-2 parágrafos. Sem mencionar números ou mecânicas.',
        },
      ],
      maxCompletionTokens: 250,
      reasoningEffort: 'low',
      timeoutMs: 10000,
    })

    return resp?.trim() || fallbackDiceRoll(rollerName, roll, isCrit, isCritFail)
  } catch {
    return fallbackDiceRoll(rollerName, roll, isCrit, isCritFail)
  }
}

/* ══════════════════════════════════════════════
   Fallback templates (when AI fails)
   ══════════════════════════════════════════════ */

function fallbackIntro(ctx: BattleNarrativeContext): string {
  return (
    `O ar fica pesado em ${ctx.location.name}. ` +
    `${ctx.playerNames.join(', ')} se posicionam para o combate enquanto ` +
    `${ctx.enemyNames.join(' e ')} surgem das sombras.\n\n` +
    'O vento para. O silêncio dura um instante. E então — a batalha começa.'
  )
}

function fallbackConclusion(ctx: BattleNarrativeContext, victory: boolean): string {
  if (victory) {
    return (
      `O último inimigo cai. ${ctx.playerNames.join(', ')} respiram fundo enquanto o silêncio retorna a ${ctx.location.name}.\n\n` +
      'A poeira baixa. A vitória é deles — pelo menos por enquanto.'
    )
  }
  return (
    `A escuridão toma conta. ${ctx.playerNames.join(', ')} tombam no campo de batalha de ${ctx.location.name}.\n\n` +
    'Mas a história não termina aqui. Heróis sempre encontram um caminho de volta.'
  )
}

function fallbackDiceRoll(
  rollerName: string,
  _roll: number,
  isCrit: boolean,
  isCritFail: boolean,
): string {
  if (isCrit) {
    return `${rollerName} lança o dado — e o destino sorri. Um resultado perfeito que muda o curso da batalha!`
  }
  if (isCritFail) {
    return `${rollerName} lança o dado — e o destino tem outros planos. Um resultado desastroso ecoa pelo campo de batalha.`
  }
  return `${rollerName} lança o dado e observa o resultado com determinação.`
}

/* ══════════════════════════════════════════════
   Battle Highlights (for conclusion narration)
   ══════════════════════════════════════════════ */

/** Extract notable moments from battle log for the AI conclusion */
export function extractBattleHighlights(state: BattleState): string[] {
  const highlights: string[] = []

  const kills = state.actionLog.filter((e) => e.isKill)
  for (const k of kills) {
    highlights.push(`${k.actorName} derrotou ${k.targetName}`)
  }

  const crits = state.actionLog.filter((e) => e.isCrit)
  for (const c of crits) {
    highlights.push(`${c.actorName} realizou um golpe crítico`)
  }

  const bigDamage = state.actionLog
    .filter((e) => e.damage && e.damage >= 15)
    .sort((a, b) => (b.damage ?? 0) - (a.damage ?? 0))
    .slice(0, 2)
  for (const d of bigDamage) {
    highlights.push(`${d.actorName} causou ${d.damage} de dano com ${d.skillName ?? 'um ataque'}`)
  }

  return highlights.slice(0, 5) // Limit to 5 highlights
}
