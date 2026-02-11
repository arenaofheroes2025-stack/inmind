import type { Location, LocationContent, World, EquipmentType } from '../data/types'
import { buildSeedLocationContent } from '../data/seed'
import { createChatCompletion } from './aiClient'
import {
  getLocationContent,
  saveLocationContent,
} from './cache'

const MAX_RETRIES = 2

const LOCATION_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA (siga EXATAMENTE este schema):
{
  "locationContent": {
    "id": string,           // formato: "content-{locationId}"
    "locationId": string,   // mesmo id do local fornecido
    "npcs": [               // MINIMO 3, MAXIMO 6 npcs
      {
        "id": string,       // formato: "{locationId}-npc-{n}"
        "name": string,     // nome proprio em portugues
        "role": string,     // VALORES: "mentor" | "comerciante" | "quest-giver" | "guarda" | "informante" | "aliado" | "misterioso"
        "description": string, // 1-2 frases descrevendo aparencia e personalidade
        "narrativeEffect": string // 1 frase sobre o impacto narrativo de interagir com este NPC
      }
    ],
    "quests": {
      "main": [             // MINIMO 1 quest principal
        {
          "id": string,     // formato: "{locationId}-quest-main-{n}"
          "title": string,  // titulo curto e evocativo
          "type": "main",   // FIXO
          "description": string, // 2-3 frases sobre objetivo
          "narrativeEffect": string // 1 frase sobre consequencia na historia
        }
      ],
      "side": [             // MINIMO 2 quests secundarias
        { /* mesma estrutura de quest, type: "side" */ }
      ],
      "ambient": [          // MINIMO 2 quests ambiente
        { /* mesma estrutura de quest, type: "ambient" */ }
      ]
    },
    "enemies": [            // MINIMO 2 inimigos
      {
        "id": string,       // formato: "{locationId}-enemy-{n}"
        "name": string,     // nome proprio
        "description": string, // 1-2 frases sobre aparencia e comportamento
        "narrativeEffect": string // 1 frase sobre o que acontece ao encontrar este inimigo
      }
    ],
    "items": [              // MINIMO 4 itens VARIADOS (armas, pocoes, materiais, chaves etc)
      {
        "id": string,       // formato: "{locationId}-item-{n}"
        "name": string,     // nome do item em portugues
        "type": string,     // VALORES: "arma" | "armadura" | "escudo" | "pocao" | "pergaminho" | "amuleto" | "anel" | "ferramenta" | "material" | "chave" | "tesouro"
        "description": string, // 1-2 frases descritivas
        "narrativeEffect": string // flavor text: o que acontece narrativamente ao usar/encontrar o item
      }
    ],
    "narrativeImpact": string // 1-2 frases sobre como este local afeta a historia
  }
}
IMPORTANTE: Gere conteudo VARIADO e ABUNDANTE. Quanto mais opcoes narrativas, melhor para o jogador.
Os detalhes completos (stats, recompensas, inventario) serao gerados sob demanda quando o jogador interagir.
Foque em criar opcoes narrativas ricas e diversificadas.
`

const systemPrompt =
  'Voce e o Location Architect de um RPG narrativo imersivo.\n' +
  'REGRAS RIGIDAS:\n' +
  '1. Responda APENAS com JSON valido. Sem markdown, sem comentarios, sem texto fora do JSON.\n' +
  '2. Siga EXATAMENTE o schema fornecido. Nao adicione campos extras. Nao omita campos.\n' +
  '3. Todo conteudo narrativo DEVE ser em PORTUGUES DO BRASIL.\n' +
  '4. Todos os ids devem seguir o formato especificado no schema.\n' +
  '5. Crie conteudo rico, coerente com o genero e tom do mundo.\n' +
  '6. O JSON raiz deve ter UMA unica chave: "locationContent".'

function parseJsonPayload(raw: string) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  const json = raw.slice(start, end + 1)
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Extract text content from various AI response formats.
 */
function extractContent(response: Record<string, unknown>): string {
  const choices = response?.choices as Array<{
    message?: { content?: string | null; reasoning_content?: string; refusal?: string }
    text?: string
    finish_reason?: string
  }> | undefined

  if (choices?.[0]) {
    const choice = choices[0]
    if (choice.finish_reason === 'content_filter') {
      console.error('[LocationArchitect] Response blocked by content filter')
    }
    if (choice.message?.refusal) {
      console.error('[LocationArchitect] Model refused:', choice.message.refusal)
    }
    if (choice.message?.content && choice.message.content.length > 0) return choice.message.content
    if (choice.message?.reasoning_content && choice.message.reasoning_content.length > 0) return choice.message.reasoning_content
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
  if (response?.result && typeof response.result === 'string') return response.result
  console.error('[LocationArchitect] No content in response:', JSON.stringify(response).slice(0, 1000))
  return ''
}

export async function generateLocationContent(
  location: Location,
  world?: World,
): Promise<LocationContent> {
  const locId = location.id

  const worldContext = world
    ? `Mundo: "${world.title}" | Genero: ${world.genre} | Tom: ${world.tone}\n` +
      `Sinopse: ${world.synopsis}\n` +
      (world.narrativeStyle ? `Estilo: ${world.narrativeStyle}\n` : '')
    : ''

  const userPrompt =
    worldContext +
    `\nLocal a detalhar:\n` +
    `  Nome: ${location.name}\n` +
    `  Tipo: ${location.type}\n` +
    (location.description ? `  Descricao: ${location.description}\n` : '') +
    `  Nivel de perigo: ${location.dangerLevel}/10\n` +
    `  Relevancia: ${location.storyRelevance}\n` +
    `  ID do local: ${locId}\n` +
    LOCATION_SCHEMA

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[LocationArchitect] Generating content for "${location.name}" (attempt ${attempt})`)

      const response = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxCompletionTokens: 8000,
        reasoningEffort: 'low',
      })

      const raw = extractContent(response as Record<string, unknown>)
      if (!raw) {
        console.warn(`[LocationArchitect] Empty response on attempt ${attempt}`)
        continue
      }

      const parsed = parseJsonPayload(raw)

      if (parsed?.locationContent) {
        const lc = parsed.locationContent as LocationContent
        console.log(`[LocationArchitect] Successfully generated content for "${location.name}"`)
        return {
          ...lc,
          id: lc.id ?? `content-${locId}`,
          locationId: lc.locationId ?? locId,
          npcs: Array.isArray(lc.npcs)
            ? lc.npcs.map((n: Record<string, unknown>) => ({
                id: String(n.id ?? `${locId}-npc-0`),
                name: String(n.name ?? 'Desconhecido'),
                role: String(n.role ?? 'misterioso'),
                description: String(n.description ?? ''),
                narrativeEffect: String(n.narrativeEffect ?? ''),
              }))
            : [],
          quests: {
            main: Array.isArray(lc.quests?.main)
              ? lc.quests.main.map((q: Record<string, unknown>) => ({
                  id: String(q.id ?? `${locId}-quest-main-0`),
                  title: String(q.title ?? 'Missao'),
                  type: 'main' as const,
                  description: String(q.description ?? ''),
                  narrativeEffect: String(q.narrativeEffect ?? ''),
                }))
              : [],
            side: Array.isArray(lc.quests?.side)
              ? lc.quests.side.map((q: Record<string, unknown>) => ({
                  id: String(q.id ?? `${locId}-quest-side-0`),
                  title: String(q.title ?? 'Missao'),
                  type: 'side' as const,
                  description: String(q.description ?? ''),
                  narrativeEffect: String(q.narrativeEffect ?? ''),
                }))
              : [],
            ambient: Array.isArray(lc.quests?.ambient)
              ? lc.quests.ambient.map((q: Record<string, unknown>) => ({
                  id: String(q.id ?? `${locId}-quest-ambient-0`),
                  title: String(q.title ?? 'Missao'),
                  type: 'ambient' as const,
                  description: String(q.description ?? ''),
                  narrativeEffect: String(q.narrativeEffect ?? ''),
                }))
              : [],
          },
          enemies: Array.isArray(lc.enemies)
            ? lc.enemies.map((e: Record<string, unknown>) => ({
                id: String(e.id ?? `${locId}-enemy-0`),
                name: String(e.name ?? 'Criatura'),
                description: String(e.description ?? ''),
                narrativeEffect: String(e.narrativeEffect ?? ''),
              }))
            : [],
          items: Array.isArray(lc.items)
            ? lc.items.map((it: Record<string, unknown>) => ({
                id: String(it.id ?? `${locId}-item-0`),
                name: String(it.name ?? 'Item Misterioso'),
                type: (String(it.type ?? 'ferramenta') as EquipmentType),
                description: String(it.description ?? ''),
                narrativeEffect: String(it.narrativeEffect ?? ''),
              }))
            : [],
          narrativeImpact: lc.narrativeImpact ?? 'Este local guarda segredos a serem revelados.',
        }
      }

      console.warn(`[LocationArchitect] No locationContent key in parsed JSON (attempt ${attempt})`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[LocationArchitect] Attempt ${attempt} failed:`, lastError.message)
      if (lastError.message.includes('content_filter') || lastError.message.includes('recusou')) {
        break
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }

  console.warn(`[LocationArchitect] All attempts failed for "${location.name}", using seed fallback`)
  return buildSeedLocationContent(location)
}

export async function cacheLocationContent(content: LocationContent) {
  await saveLocationContent(content)
}

export async function getOrCreateLocationContent(location: Location, world?: World) {
  const cached = await getLocationContent(`content-${location.id}`)
  if (cached) {
    console.log(`[LocationArchitect] Using cached content for "${location.name}"`)
    return cached
  }

  console.log(`[LocationArchitect] No cache for "${location.name}", generating...`)
  const content = await generateLocationContent(location, world)
  const normalized = {
    ...content,
    id: `content-${location.id}`,
    locationId: location.id,
  }
  await cacheLocationContent(normalized)
  console.log(`[LocationArchitect] Content saved for "${location.name}"`)
  return normalized
}
