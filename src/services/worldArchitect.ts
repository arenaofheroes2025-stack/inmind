import type { ActMission, Location, SaveState, World } from '../data/types'
import { createChatCompletion } from './aiClient'
import { createImage } from './imageAiClient'
import { saveLocation, saveSaveState, saveWorld } from './cache'

export type WorldBlueprint = {
  world: World
  locations: Location[]
}

/**
 * Extract text content from various AI response formats.
 * Supports: Azure OpenAI, OpenAI, reasoning models, content filters, etc.
 */
function extractContent(response: Record<string, unknown>): string {
  // Standard OpenAI / Azure OpenAI format
  const choices = response?.choices as Array<{
    message?: { content?: string | null; reasoning_content?: string; refusal?: string }
    text?: string
    finish_reason?: string
    content_filter_results?: Record<string, unknown>
  }> | undefined

  if (choices?.[0]) {
    const choice = choices[0]

    // Check for content filter block
    if (choice.finish_reason === 'content_filter') {
      console.error('[extractContent] Response blocked by Azure content filter')
      throw new Error(
        'A resposta foi bloqueada pelo filtro de conteudo do Azure. ' +
        'Tente novamente com um prompt diferente.'
      )
    }

    // Check for refusal
    if (choice.message?.refusal) {
      console.error('[extractContent] Model refused:', choice.message.refusal)
      throw new Error('O modelo recusou gerar o conteudo. Tente novamente.')
    }

    // Standard content field
    if (choice.message?.content && choice.message.content.length > 0) {
      return choice.message.content
    }

    // Content is explicitly null — might be a reasoning model that put output elsewhere
    if (choice.message?.content === null) {
      console.warn('[extractContent] content is null, checking reasoning_content and other fields')
    }

    // Reasoning content fallback (some Azure models)
    if (choice.message?.reasoning_content && choice.message.reasoning_content.length > 0) {
      console.warn('[extractContent] Using reasoning_content as fallback')
      return choice.message.reasoning_content
    }

    // Legacy text field
    if (choice.text) return choice.text

    // Token limit truncation — log warning
    if (choice.finish_reason === 'length') {
      console.warn('[extractContent] Response was truncated (finish_reason=length)')
    }
  }

  // Responses API / reasoning models format
  const output = response?.output
  if (typeof output === 'string' && output.length > 0) return output
  if (Array.isArray(output)) {
    for (const item of output) {
      // { type: 'message', content: [{ type: 'output_text', text: '...' }] }
      if (item?.content && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block?.text) return String(block.text)
          if (block?.content) return String(block.content)
        }
      }
      // { type: 'text', text: '...' }
      if (item?.text) return String(item.text)
      if (item?.message?.content) return String(item.message.content)
    }
  }

  // Other formats
  if (response?.result && typeof response.result === 'string') return response.result
  if (response?.content && typeof response.content === 'string') return response.content
  const msg = response?.message as Record<string, unknown> | undefined
  if (msg?.content && typeof msg.content === 'string') return msg.content

  // Last resort: stringify full response for debugging
  console.error('[extractContent] Could not find content in response:', JSON.stringify(response).slice(0, 2000))
  return ''
}

const systemPrompt =
  'Voce e o World Architect. Gere um blueprint de mundo COMPLETO para um RPG narrativo. ' +
  'IDIOMA: Todo o conteudo narrativo (titulo, synopsis, nomes de locais, nomes de atos, goals, descricoes, finalObjective, missoes, NPCs) DEVE ser em PORTUGUES DO BRASIL. ' +
  'Apenas os prompts de imagem (imagePrompts) devem ser em ingles.\n\n' +
  'O blueprint deve conter:\n' +
  '- world: { id, title, genre, narrativeStyle, tone, synopsis, acts, locations (array de {id}), finalObjective, createdAt }\n' +
  '- acts: array de atos narrativos em ORDEM CRONOLOGICA. Cada ato representa um capitulo da historia:\n' +
  '  {\n' +
  '    id: string,\n' +
  '    title: string (nome evocativo do ato),\n' +
  '    goal: string (objetivo narrativo do ato),\n' +
  '    missions: [ // MINIMO 3 missoes por ato — definem QUANDO o ato eh concluido\n' +
  '      {\n' +
  '        id: string,\n' +
  '        title: string (nome da missao),\n' +
  '        description: string (o que o jogador deve fazer),\n' +
  '        narrativeDirection: string (para onde a historia avanca ao completar esta missao),\n' +
  '        linkedNpcNames: [string] (nomes dos NPCs importantes envolvidos)\n' +
  '      }\n' +
  '    ],\n' +
  '    keyNpcs: [ // personagens importantes deste ato\n' +
  '      { name: string, role: string ("aliado"|"vilao"|"mentor"|"mercador"|"informante"|"guardiao") }\n' +
  '    ],\n' +
  '    linkedLocations: [{id: string}] (locais onde este ato se passa),\n' +
  '    requiredActId: string | null (id do ato anterior que precisa ser concluido — null para o primeiro ato)\n' +
  '  }\n' +
  '- locations: array com MINIMO 4 e MAXIMO 9 locais:\n' +
  '  {\n' +
  '    id, name, type, description (1-2 frases visuais do cenario),\n' +
  '    dangerLevel (1-5), storyRelevance ("main"|"side"),\n' +
  '    linkedActs: [{id}],\n' +
  '    unlockedByActId: string | null (se NAO nulo, este local fica BLOQUEADO ate o ato indicado ser concluido. ' +
  'Locais do Ato 1 devem ter unlockedByActId: null. Locais dos atos seguintes devem exigir a conclusao do ato anterior.)\n' +
  '  }\n' +
  '- imagePrompts: { map: string, locations: { [locationId]: string } }\n\n' +
  'REGRAS DE PROGRESSAO:\n' +
  '- TODOS os atos devem ter PELO MENOS 3 missoes. As missoes definem o progresso dentro do ato.\n' +
  '- Quando TODAS as missoes de um ato sao concluidas, o ato e considerado completo e o proximo ato e desbloqueado.\n' +
  '- Locais ligados a atos futuros devem ter "unlockedByActId" apontando para o ato anterior (ex: locais do Ato 2 exigem Ato 1 concluido).\n' +
  '- Locais do Ato 1 e locais secundarios ("side") podem ter unlockedByActId: null (sempre acessiveis).\n' +
  '- As missoes devem ter narrativa RICA: descrever motivacao, conflito, obstaculos esperados.\n' +
  '- O campo "narrativeDirection" indica o que muda na historia quando a missao e concluida (ex: "O grupo descobre a localizacao do artefato perdido").\n' +
  '- Os keyNpcs de cada ato serao personagens com quem o jogador interage durante as missoes.\n\n' +
  'REGRAS IMPORTANTES:\n' +
  '- O campo "title" do world DEVE ser um titulo CRIATIVO e EVOCATIVO para a aventura (ex: "A Chama de Prometeu", "O Concilio das Sombras"). ' +
  'NAO use o prompt do usuario como titulo. Crie um nome proprio que soe como titulo de livro/jogo.\n' +
  '- O campo "narrativeStyle" deve conter o estilo narrativo (ex: "Misterio / Investigacao", "Aventura", "Terror").\n' +
  '- Gere no MINIMO 4 e no MAXIMO 9 locais variados. Misture locais principais e secundarios.\n\n' +
  'REGRAS PARA PROMPTS DE IMAGEM:\n' +
  '- Estilo: ilustracao 2D anime, colorida, detalhada, sem texto/letras.\n' +
  '- Mapa: visto de cima, estilo cartografico fantasia, com montanhas/florestas/rios/vilas/estradas/bordas decorativas.\n' +
  '- COESAO VISUAL: O prompt do mapa deve descrever a geografia do mundo. ' +
  'Cada prompt de local DEVE ser uma ILUSTRACAO DE CENARIO/PAISAGEM que represente o bioma daquele local. ' +
  'NAO gere prompts de mapa para os locais — gere apenas paisagens e cenarios detalhados com a mesma paleta de cores e estilo do mapa. ' +
  'Os locais devem parecer PARTES DO MESMO MUNDO.\n' +
  '- Locais: ilustracao de paisagem/cenario ampla, atmosfera coerente com tipo e perigo, perspectiva de cenario. NAO eh mapa.\n' +
  '- Todos os prompts de imagem devem ser em ingles.\n\n' +
  'INTRODUCAO NARRATIVA (campo "introNarrative" no world):\n' +
  '- O world DEVE conter um campo "introNarrative": string com ATE 1000 caracteres.\n' +
  '- Este texto e a ABERTURA CINEMATICA da aventura: apresenta o mundo, o contexto da historia, o que esta acontecendo, ' +
  'o que se espera dos herois, onde eles estao e o que inicia a primeira missao.\n' +
  '- Deve ter tom narrativo rico e imersivo, como a abertura de um filme ou livro — coerente com o genero e tom do mundo.\n' +
  '- NAO inclua dialogo dos personagens jogaveis. Fale sobre o mundo e a situacao, nao sobre os herois em si.\n' +
  '- Ao final, mencione naturalmente a primeira missao e o local onde ela comeca.\n\n' +
  'LOCAL INICIAL (campo "startingLocationId" no world):\n' +
  '- O world DEVE conter "startingLocationId": string com o ID de um dos locais do Ato 1.\n' +
  '- Este e o local onde a aventura comeca. Deve ser um local acessivel (unlockedByActId: null) ligado ao primeiro ato.\n\n' +
  'PRIMEIRA MISSAO ATIVA:\n' +
  '- A primeira missao do primeiro ato ja comeca ATIVA. Os jogadores iniciam o jogo com ela disponivel.\n' +
  '- Garanta que a primeira missao do Ato 1 tenha descricao clara e motivacao evidente na introNarrative.\n\n' +
  'Responda APENAS com JSON valido, sem markdown, sem comentarios.'

function uid() {
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeWorld(input: World, locations: Location[]): { world: World; locations: Location[]; idMap: Record<string, string> } {
  // Generate a unique world ID
  const worldId = `world-${uid()}`

  // Build a map from AI-generated IDs to unique IDs
  const idMap: Record<string, string> = {}
  const oldWorldId = input.id
  idMap[oldWorldId] = worldId

  for (const loc of locations) {
    const newLocId = `${worldId}-loc-${uid().slice(0, 8)}`
    idMap[loc.id] = newLocId
  }

  // Remap location IDs and add worldId
  const remappedLocations: Location[] = locations.map((loc) => ({
    ...loc,
    id: idMap[loc.id] ?? loc.id,
    worldId,
    linkedActs: (loc.linkedActs ?? []).map((a) => ({ id: idMap[a.id] ?? a.id })),
  }))

  // Remap act IDs and mission IDs
  const acts = (input.acts ?? []).map((act) => {
    const newActId = `${worldId}-act-${uid().slice(0, 8)}`
    idMap[act.id] = newActId
    return act
  }).map((act) => ({
    ...act,
    id: idMap[act.id] ?? act.id,
    linkedLocations: (act.linkedLocations ?? []).map((l) => ({ id: idMap[l.id] ?? l.id })),
    requiredActId: act.requiredActId ? (idMap[act.requiredActId] ?? act.requiredActId) : undefined,
    missions: (act.missions ?? []).map((m: ActMission) => ({
      ...m,
      id: `${idMap[act.id] ?? act.id}-mission-${uid().slice(0, 6)}`,
      completed: false,
    })),
    keyNpcs: act.keyNpcs ?? [],
  }))

  // Re-remap locations' linkedActs and unlockedByActId now that act IDs are known
  const finalLocations = remappedLocations.map((loc) => ({
    ...loc,
    linkedActs: (loc.linkedActs ?? []).map((a) => ({ id: idMap[a.id] ?? a.id })),
    unlockedByActId: loc.unlockedByActId ? (idMap[loc.unlockedByActId] ?? loc.unlockedByActId) : undefined,
  }))

  // Remap startingLocationId
  const remappedStartingLocId = input.startingLocationId
    ? (idMap[input.startingLocationId] ?? input.startingLocationId)
    : undefined

  const world: World = {
    ...input,
    id: worldId,
    acts,
    locations: finalLocations.map((l) => ({ id: l.id })),
    introNarrative: input.introNarrative ?? undefined,
    startingLocationId: remappedStartingLocId,
    createdAt: new Date().toISOString(),
  }

  return { world, locations: finalLocations, idMap }
}

function parseJsonPayload(raw: string) {
  // 1. Strip markdown code-block wrappers if present (```json ... ```)
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '')

  // 2. Find outermost { ... }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  let json = cleaned.slice(start, end + 1)

  // 3. Try direct parse first
  try {
    return JSON.parse(json)
  } catch (e1) {
    console.warn('[parseJsonPayload] First parse failed:', (e1 as Error).message)

    // 4. Attempt common repairs
    try {
      // Remove trailing commas before } or ]
      json = json.replace(/,\s*([}\]])/g, '$1')
      // Fix unescaped newlines inside strings (replace literal newlines between quotes)
      json = json.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      return JSON.parse(json)
    } catch (e2) {
      console.warn('[parseJsonPayload] Repair attempt 1 failed:', (e2 as Error).message)
    }

    // 5. Last resort: try to close truncated JSON
    try {
      let candidate = cleaned.slice(start)
      // Count unclosed braces/brackets and close them
      let braces = 0, brackets = 0
      let inString = false, escape = false
      for (const ch of candidate) {
        if (escape) { escape = false; continue }
        if (ch === '\\') { escape = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === '{') braces++
        else if (ch === '}') braces--
        else if (ch === '[') brackets++
        else if (ch === ']') brackets--
      }
      // If we're inside a string, close it
      if (inString) candidate += '"'
      // Close any open brackets/braces
      while (brackets > 0) { candidate += ']'; brackets-- }
      while (braces > 0) { candidate += '}'; braces-- }
      // Remove trailing commas
      candidate = candidate.replace(/,\s*([}\]])/g, '$1')
      const result = JSON.parse(candidate)
      console.log('[parseJsonPayload] Repaired truncated JSON successfully')
      return result
    } catch (e3) {
      console.error('[parseJsonPayload] All parse attempts failed:', (e3 as Error).message)
      console.error('[parseJsonPayload] Raw content tail:', raw.slice(-200))
      return null
    }
  }
}

type ImagePrompts = {
  map: string
  locations: Record<string, string>
}

export async function generateWorldBlueprint(
  adventurePrompt: string,
): Promise<{ blueprint: WorldBlueprint; imagePrompts: ImagePrompts | null }> {
  const MAX_RETRIES = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[WorldArchitect] Attempt ${attempt}/${MAX_RETRIES}...`)

      const response = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              adventurePrompt +
              '\n\nFormato esperado: {"world":{...},"locations":[...],"imagePrompts":{"map":"...","locations":{"loc-id":"..."}}}',
          },
        ],
        maxCompletionTokens: 10000,
        reasoningEffort: 'low',
        timeoutMs: 90_000, // 90s — reduced tokens + low reasoning = faster
      })

      // Extract content from various API response formats (Azure OpenAI, OpenAI, etc.)
      const content = extractContent(response)

      console.log('[WorldArchitect] Extracted content length:', content.length)
      console.log('[WorldArchitect] Content preview:', content.slice(0, 300))

      if (!content || content.length < 20) {
        // Log the full response to help diagnose
        console.error('[WorldArchitect] Empty content. Full response:', JSON.stringify(response).slice(0, 3000))
        throw new Error('A IA retornou uma resposta vazia. Tente novamente.')
      }

      const parsed = parseJsonPayload(content)

      if (!parsed?.world || !parsed?.locations) {
        console.error('[WorldArchitect] Failed to parse AI response.')
        console.error('[WorldArchitect] Content length:', content.length)
        console.error('[WorldArchitect] Content start:', content.slice(0, 400))
        console.error('[WorldArchitect] Content end:', content.slice(-300))
        console.error('[WorldArchitect] parsed keys:', parsed ? Object.keys(parsed) : 'null')
        throw new Error('Falha ao interpretar a resposta da IA. Tente novamente.')
      }

      if (parsed.locations.length < 3) {
        console.warn('[WorldArchitect] AI returned fewer than 3 locations')
      }

      const { world, locations, idMap } = normalizeWorld(parsed.world as World, parsed.locations as Location[])

      // Remap image prompt keys from AI IDs to new unique IDs
      const rawImagePrompts = parsed.imagePrompts as ImagePrompts | undefined
      let imagePrompts: ImagePrompts | null = null
      if (rawImagePrompts) {
        const remappedLocations: Record<string, string> = {}
        for (const [oldId, prompt] of Object.entries(rawImagePrompts.locations ?? {})) {
          const newId = idMap[oldId] ?? oldId
          remappedLocations[newId] = prompt
        }
        imagePrompts = { map: rawImagePrompts.map, locations: remappedLocations }
      }

      return {
        blueprint: { world, locations },
        imagePrompts,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[WorldArchitect] Attempt ${attempt} failed:`, lastError.message)
      // If this was a content filter block, don't retry (it'll just fail again)
      if (lastError.message.includes('filtro de conteudo') || lastError.message.includes('recusou gerar')) {
        throw lastError
      }
      // Otherwise retry after a brief delay
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
  }

  // All retries exhausted
  throw lastError ?? new Error('Falha ao gerar o mundo apos multiplas tentativas.')
}

export async function createAndCacheWorld(
  adventurePrompt: string,
  onProgress?: (stage: string) => void,
) {
  onProgress?.('Gerando mundo...')
  const { blueprint, imagePrompts } = await generateWorldBlueprint(adventurePrompt)
  // Pick the starting location: world.startingLocationId > first linked location from Act 1 > locations[0]
  const startLocId = blueprint.world.startingLocationId
    && blueprint.locations.some((l) => l.id === blueprint.world.startingLocationId)
    ? blueprint.world.startingLocationId
    : undefined
  const firstActLocId = blueprint.world.acts[0]?.linkedLocations?.[0]?.id
  const fallbackLocId = firstActLocId
    && blueprint.locations.some((l) => l.id === firstActLocId)
    ? firstActLocId
    : blueprint.locations[0]?.id ?? ''
  const firstLocationId = startLocId ?? fallbackLocId
  const saveState: SaveState = {
    id: `save-${blueprint.world.id}`,
    worldId: blueprint.world.id,
    characterId: 'character-pending',
    currentLocationId: firstLocationId,
    activeQuestIds: [],
    currentActId: blueprint.world.acts[0]?.id ?? '',
    completedActIds: [],
    completedMissionIds: [],
    phase: 'ready',
    updatedAt: new Date().toISOString(),
  }

  onProgress?.('Salvando dados...')
  // 1) Persist world data to IndexedDB (fast — no images yet)
  await saveWorld(blueprint.world)
  await Promise.all(blueprint.locations.map((location) => saveLocation(location)))
  await saveSaveState(saveState)
  console.log('[WorldArchitect] World JSON + locations saved to DB.')

  // 2) Generate images IN THE BACKGROUND — don't block navigation
  onProgress?.('Gerando imagens em segundo plano...')
  generateAllImages(blueprint.world, blueprint.locations, imagePrompts)
    .then(() => {
      console.log('[WorldArchitect] All images done. mapUrl:', blueprint.world.mapUrl ? 'YES' : 'NO')
      console.log('[WorldArchitect] Locations:', blueprint.locations.map(l => `${l.name}: ${l.imageUrl ? 'YES' : 'NO'}`).join(', '))
    })
    .catch((imgErr) => {
      console.error('[WorldArchitect] Image generation failed (non-fatal):', imgErr)
    })

  return blueprint
}

/* ─── Image generation ─── */

/** Run async tasks with limited concurrency */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  let nextIdx = 0

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++
      try {
        const value = await tasks[idx]()
        results[idx] = { status: 'fulfilled', value }
      } catch (reason) {
        results[idx] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

/** Max 4 concurrent image requests — faster generation with acceptable rate-limit risk */
const IMAGE_CONCURRENCY = 4

async function generateAllImages(
  world: World,
  locations: Location[],
  prompts: ImagePrompts | null,
) {
  const mapContext = prompts?.map ?? ''

  // Build task factories (lazy — only start when the worker picks them up)
  const tasks: (() => Promise<void>)[] = [
    () => generateWorldMap(world, locations, prompts?.map),
    ...locations.map((loc) => {
      const locPrompt = prompts?.locations?.[loc.id]
      return () => generateLocationImage(loc, world, locPrompt, mapContext)
    }),
  ]

  console.log(`[WorldArchitect] Generating ${tasks.length} images (concurrency: ${IMAGE_CONCURRENCY})...`)
  await runWithConcurrency(tasks, IMAGE_CONCURRENCY)
}

async function generateWorldMap(world: World, locations: Location[], mapPrompt?: string) {
  const locationNames = locations
    .map((l) => l.name ?? l.id)
    .slice(0, 8)
    .join(', ')

  const prompt = mapPrompt ||
    `2D anime-style top-down RPG world map, highly detailed and colorful. ` +
    `Theme: "${world.title}" (${world.genre}, ${world.tone}). ` +
    `Key locations: ${locationNames}. ` +
    `Fantasy cartographic style with mountains, forests, rivers, villages, roads and decorative borders. ` +
    `No text, no letters, no written labels.`

  console.log('[WorldArchitect] Generating world map image...')
  console.log('[WorldArchitect] Map prompt:', prompt.slice(0, 200))

  try {
    const result = await createImage(prompt, { aspectRatio: '16:9' })
    console.log('[WorldArchitect] Map image API response:', JSON.stringify(result).slice(0, 300))
    const mapUrl = result?.data?.[0]?.url
    if (mapUrl) {
      console.log('[WorldArchitect] Map URL obtained:', mapUrl.slice(0, 80))
      world.mapUrl = mapUrl
      await saveWorld(world)
    } else {
      console.warn('[WorldArchitect] Map image response had no URL. Full response:', JSON.stringify(result))
    }
  } catch (err) {
    console.error('[WorldArchitect] Map image generation failed:', err)
  }
}

async function generateLocationImage(loc: Location, world: World, locPrompt?: string, mapContext?: string) {
  // Build a cohesive prompt — scenery/landscape of the location, NOT a map
  const cohesionSuffix = mapContext
    ? ` This location exists within the same world. Maintain the same art style, color palette, and visual atmosphere as the rest of the world.`
    : ''

  const prompt = locPrompt
    ? locPrompt + cohesionSuffix
    : `2D anime-style detailed landscape illustration showing the scenery of a ${loc.type} called "${loc.name}". ` +
      `Setting: ${world.genre}, ${world.tone} tone. Danger level ${loc.dangerLevel}/5. ` +
      `${loc.description ?? ''}. ` +
      `Show the biome and environment as if you are standing there looking at the place. ` +
      `Wide scenic view, atmospheric, detailed environment. No text, no labels, no map view.` +
      cohesionSuffix

  console.log(`[WorldArchitect] Generating image for location "${loc.name}"...`)

  try {
    const result = await createImage(prompt, { aspectRatio: '16:9' })
    const imageUrl = result?.data?.[0]?.url
    if (imageUrl) {
      console.log(`[WorldArchitect] Location "${loc.name}" image obtained:`, imageUrl.slice(0, 80))
      loc.imageUrl = imageUrl
      await saveLocation(loc)
    } else {
      console.warn(`[WorldArchitect] Location "${loc.name}" image response had no URL:`, JSON.stringify(result).slice(0, 300))
    }
  } catch (err) {
    console.error(`[WorldArchitect] Location "${loc.name}" image failed:`, err)
  }
}
