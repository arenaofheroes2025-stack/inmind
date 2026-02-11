/**
 * Character Architect — AI agent that generates character creation options
 * (archetypes, races, appearance presets) tailored to the world context.
 *
 * Results are cached in IndexedDB per-world so the AI is only called once.
 */

import type { World } from '../data/types'
import { createChatCompletion } from './aiClient'
import { getCharacterOptions, saveCharacterOptions, listLocationsByWorld } from './cache'

/* ─── Output structure (mirrors the hardcoded arrays in CharacterCreateScreen) ─── */

export type ArchetypeOption = {
  id: string   // class name used as archetype on Character
  desc: string // short 3-6 word description
}

export type CharacterCreationOptions = {
  archetypes: ArchetypeOption[] // exactly 8
  appearancePresets: {
    genero: string[]
    raca: string[]
    idade: string[]
    pele: string[]
    cabelo: string[]
    corCabelo: string[]
    olhos: string[]
    altura: string[]
    traje: string[]
    acessorio: string[]
    detalhe: string[]
  }
}

/* ─── Prompt ─── */

function buildSystemPrompt() {
  return (
    'Voce e o Character Architect. Dado o contexto de um mundo de RPG, gere opcoes de CRIACAO DE PERSONAGEM ' +
    'que sejam tematicas, coerentes e interessantes para esse universo.\n\n' +
    'REGRAS:\n' +
    '1. Responda APENAS com JSON valido, sem markdown, sem comentarios.\n' +
    '2. Todo conteudo em PORTUGUES DO BRASIL.\n' +
    '3. Estrutura exata:\n' +
    '{\n' +
    '  "archetypes": [ { "id": "NomeDaClasse", "desc": "Descricao curta 3-6 palavras" }, ... ],\n' +
    '  "appearancePresets": {\n' +
    '    "genero": ["opcao1", ...],\n' +
    '    "raca": ["opcao1", ...],\n' +
    '    "idade": ["opcao1", ...],\n' +
    '    "pele": ["opcao1", ...],\n' +
    '    "cabelo": ["opcao1", ...],\n' +
    '    "corCabelo": ["opcao1", ...],\n' +
    '    "olhos": ["opcao1", ...],\n' +
    '    "altura": ["opcao1", ...],\n' +
    '    "traje": ["opcao1", ...],\n' +
    '    "acessorio": ["opcao1", ...],\n' +
    '    "detalhe": ["opcao1", ...]\n' +
    '  }\n' +
    '}\n\n' +
    'QUANTIDADES EXATAS:\n' +
    '- archetypes: exatamente 8 classes/arquetipos\n' +
    '- genero: 2 opcoes\n' +
    '- raca: 10-12 racas/especies tematicas do mundo\n' +
    '- idade: 4-5 faixas etarias\n' +
    '- pele: 8-10 tons\n' +
    '- cabelo: 10-12 estilos\n' +
    '- corCabelo: 10-12 cores\n' +
    '- olhos: 8-10 tipos\n' +
    '- altura: 5-6 portes\n' +
    '- traje: 8-10 vestimentas tematicas\n' +
    '- acessorio: 8-10 incluindo "Nenhum"\n' +
    '- detalhe: 8-10 detalhes marcantes incluindo "Nenhum"\n\n' +
    'TEMATICA:\n' +
    '- As classes devem fazer sentido no genero/tom do mundo (ex: mundo biblico → Profeta, Guerreiro de Deus; ' +
    'cyberpunk → Hacker, Mercenario; medieval → Cavaleiro, Mago).\n' +
    '- As racas devem refletir o universo (ex: sci-fi → humano, androide, alienígena; ' +
    'biblico → Israelita, Filisteu, Amalequita).\n' +
    '- Trajes, acessorios e detalhes devem ser coerentes com o genero/epoca do mundo.\n' +
    '- Se o mundo for historico/real, mantenha racas como etnias/povos em vez de fantasia.\n'
  )
}

function buildUserPrompt(world: World, locationNames: string[]) {
  const locNames = locationNames.length > 0 ? locationNames.join(', ') : 'Varios locais'
  const acts = world.acts?.map((a) => `${a.title}: ${a.goal}`).join('; ') ?? ''

  return (
    `Mundo: "${world.title}" | Genero: ${world.genre} | Tom: ${world.tone}\n` +
    `Sinopse: ${world.synopsis}\n` +
    `Locais: ${locNames}\n` +
    `Atos: ${acts}\n\n` +
    'Gere opcoes de criacao de personagem tematicas para este mundo. Responda APENAS com JSON.'
  )
}

/* ─── JSON parser (robust, same approach as worldArchitect) ─── */

function parseJsonPayload(raw: string): CharacterCreationOptions | null {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '')

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null

  let json = cleaned.slice(start, end + 1)

  // Try direct parse
  try {
    return JSON.parse(json) as CharacterCreationOptions
  } catch {
    // Repair: trailing commas, literal newlines
    try {
      json = json.replace(/,\s*([}\]])/g, '$1')
      json = json.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      return JSON.parse(json) as CharacterCreationOptions
    } catch {
      // Try closing truncated JSON
      try {
        let candidate = cleaned.slice(start)
        let braces = 0, brackets = 0, inString = false, escape = false
        for (const ch of candidate) {
          if (escape) { escape = false; continue }
          if (ch === '\\') { escape = true; continue }
          if (ch === '"') { inString = !inString; continue }
          if (inString) continue
          if (ch === '{') braces++; else if (ch === '}') braces--
          if (ch === '[') brackets++; else if (ch === ']') brackets--
        }
        if (inString) candidate += '"'
        while (brackets > 0) { candidate += ']'; brackets-- }
        while (braces > 0) { candidate += '}'; braces-- }
        candidate = candidate.replace(/,\s*([}\]])/g, '$1')
        return JSON.parse(candidate) as CharacterCreationOptions
      } catch {
        console.error('[CharacterArchitect] All parse attempts failed')
        return null
      }
    }
  }
}

/* ─── Extract content (same as other architects) ─── */

function extractContent(response: Record<string, unknown>): string {
  const choices = response?.choices as Array<{
    message?: { content?: string | null }
    text?: string
  }> | undefined

  if (choices?.[0]?.message?.content) return choices[0].message.content
  if (choices?.[0]?.text) return choices[0].text

  const output = response?.output
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.content && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block?.text) return String(block.text)
        }
      }
      if (item?.text) return String(item.text)
    }
  }

  return ''
}

/* ─── Validation ─── */

function isValid(opts: CharacterCreationOptions): boolean {
  if (!Array.isArray(opts.archetypes) || opts.archetypes.length < 4) return false
  if (!opts.archetypes.every((a) => a.id && a.desc)) return false

  const p = opts.appearancePresets
  if (!p) return false
  const required: (keyof typeof p)[] = [
    'genero', 'raca', 'idade', 'pele', 'cabelo', 'corCabelo',
    'olhos', 'altura', 'traje', 'acessorio', 'detalhe',
  ]
  for (const key of required) {
    if (!Array.isArray(p[key]) || p[key].length < 2) return false
  }
  return true
}

/* ─── Main public function ─── */

const MAX_RETRIES = 3

export async function generateCharacterOptions(
  world: World,
): Promise<CharacterCreationOptions> {
  // 1. Check cache first
  const cached = await getCharacterOptions(world.id) as CharacterCreationOptions | null
  if (cached && isValid(cached)) {
    console.log('[CharacterArchitect] Using cached options for world', world.id)
    return cached
  }

  // 2. Generate via AI — load location names for richer context
  const locations = await listLocationsByWorld(world.id)
  const locationNames = locations.map((l) => l.name).filter(Boolean)
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[CharacterArchitect] Attempt ${attempt}/${MAX_RETRIES} for world "${world.title}"...`)

      const response = await createChatCompletion({
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(world, locationNames) },
        ],
        maxCompletionTokens: 3000,
        reasoningEffort: 'low',
        timeoutMs: 40_000,
      })

      const content = extractContent(response as Record<string, unknown>)
      if (!content || content.length < 50) {
        throw new Error('Resposta vazia da IA.')
      }

      const parsed = parseJsonPayload(content)
      if (!parsed || !isValid(parsed)) {
        console.error('[CharacterArchitect] Invalid structure:', content.slice(0, 400))
        throw new Error('Estrutura de resposta invalida.')
      }

      // Ensure exactly 8 archetypes (trim or pad)
      if (parsed.archetypes.length > 8) {
        parsed.archetypes = parsed.archetypes.slice(0, 8)
      }

      // 3. Cache for offline use
      await saveCharacterOptions(world.id, parsed)
      console.log('[CharacterArchitect] Options generated and cached for world', world.id)

      return parsed
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[CharacterArchitect] Attempt ${attempt} failed:`, lastError.message)
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
  }

  throw lastError ?? new Error('Falha ao gerar opcoes de personagem.')
}
