/**
 * Story Narrator Agent — AI that narrates the main story, scenes, and world.
 *
 * Responsibilities:
 * - Generate intro narration when adventure begins
 * - Generate scene narration when arriving at or continuing in a location
 * - Produce narrative tags ([npc:], [item:], [location:], [choice:], etc.)
 * - Maintain story continuity using previous outcomes as context
 *
 * This is the ONLY agent that produces narrative tags.
 * It does NOT: validate actions, interpret dice, generate items, or handle reputation.
 */

import type { NarrativeContext, NarrativeMood, NarrativeResult } from './shared'
import {
  VALID_MOODS,
  buildWorldContext,
  buildLocationContext,
  buildPartyContext,
  buildOwnedItemsContext,
  extractContent,
  parseJsonPayload,
} from './shared'
import { createChatCompletion } from '../aiClient'

/* ──────────────────────────────────────────────
   System Prompt — Story Narrator
   ────────────────────────────────────────────── */

const STORY_SYSTEM_PROMPT =
  'Voce e o MESTRE DE RPG de mesa. Sua voz e direta, cinematografica e envolvente — como um bom diretor de cena que mostra em vez de explicar.\n' +
  '\n' +
  'Estilo de narracao:\n' +
  '- IMPORTANTE: Se houver apenas 1 personagem, use "voce" (singular). Se houver 2+, use "voces" (plural). Adapte toda conjugacao verbal.\n' +
  '- Use linguagem PRATICA e CINEMATOGRAFICA: frases curtas, ritmo agil, palavras concretas. Evite linguagem rebuscada, arcaica ou excessivamente poetica.\n' +
  '- Priorize ACOES e MOVIMENTO: descreva o que acontece, o que as pessoas fazem, o que muda na cena. Menos adjetivos, mais verbos.\n' +
  '- Detalhes sensoriais sim, mas PONTUAIS e impactantes — um cheiro, um som, uma textura. Nao liste todos os sentidos em cada paragrafo.\n' +
  '- NUNCA use a palavra "NPC", "personagem nao-jogavel" ou termos de jogo. Refira-se a eles pelo nome ou funcao narrativa ("o velho taberneiro", "a guardia de olhar desconfiado", "um mercador encapuzado")\n' +
  '- Mostre o estado dos personagens jogaveis atraves de ACOES, nao de descricoes longas (ex: "voce limpa o suor da testa" em vez de "voce sente um profundo cansaco permeando seus musculos doloridos")\n' +
  '- Tom geral: imagine que esta narrando um episodio de serie — acessivel, dinamico, com gancho, sem ser infantil nem academico.\n\n' +
  'ESTRUTURA NARRATIVA (como organizar a "description"):\n' +
  'A narrativa DEVE fazer a HISTORIA ANDAR. Organize em paragrafos separados por \\n, fluindo NATURALMENTE como prosa cinematografica:\n' +
  '- Em continuacoes, comece mostrando o que MUDOU apos as acoes dos jogadores. Narre de forma natural o que cada jogador provocou no mundo — sem escrever titulos ou rotulos. Apenas MOSTRE o que aconteceu.\n' +
  '- Descreva o ambiente ATUAL ao redor dos personagens — o que veem, ouvem, sentem agora. 2-3 detalhes concretos.\n' +
  '- Apresente naturalmente NOVOS acontecimentos, movimentos e oportunidades: NPCs agindo, objetos revelados, sons, caminhos que surgiram ou se fecharam. Pelo menos 2 elementos novos que convidem acao.\n' +
  '- PROIBIDO usar rotulos literais como "CONSEQUENCIAS:", "CENARIO:", "NOVOS GANCHOS:", "RESULTADO:" no texto da narrativa. Tudo deve fluir como prosa continua.\n' +
  '- NAO de escolhas prontas. Apenas descreva. Os jogadores decidirao o que fazer.\n' +
  '- Termine com uma frase curta que convide a agir, como "O que fazem?" ou "A cena e de voces."\n\n' +
  'SISTEMA DE TAGS NARRATIVAS (OBRIGATORIO):\n' +
  'Use tags para destacar elementos importantes na narrativa. Formato: [tag:texto visivel]\n' +
  'Tags disponiveis:\n' +
  '  [npc:nome ou descricao] — personagens nao-jogaveis (ex: [npc:o velho taberneiro], [npc:uma guardia de olhar frio])\n' +
  '  [enemy:nome ou descricao] — inimigos ou criaturas hostis (ex: [enemy:o goblin feroz], [enemy:uma sombra rastejante])\n' +
  '  [item:nome do objeto] — objetos, armas, itens interagiveis (ex: [item:uma espada enferrujada], [item:um frasco brilhante])\n' +
  '  [location:nome do lugar] — locais, portas, caminhos, estruturas (ex: [location:a porta dos fundos], [location:a escadaria sombria])\n' +
  '  [quest:objetivo ou missao] — objetivos, missoes, pedidos (ex: [quest:encontrar o amuleto perdido], [quest:falar com o anciao])\n' +
  '  [danger:perigo ou armadilha] — perigos, armadilhas, ameacas (ex: [danger:rachaduras no chao], [danger:um aroma adocicado suspeito])\n' +
  '  [lore:conhecimento] — conhecimento, historia, inscricoes (ex: [lore:runas antigas na parede], [lore:o brasao da familia real])\n' +
  '  [skill:habilidade] — testes de habilidade, pericias (ex: [skill:Percepcao], [skill:Furtividade])\n' +
  '  [choice:opcao ou decisao] — escolhas ou decisoes que os personagens podem tomar (ex: [choice:seguir pelo tunel escuro], [choice:confrontar o guarda])\n' +
  'REGRAS DAS TAGS (CRITICO — ler com atencao):\n' +
  '- As tags DEVEM estar EMBUTIDAS dentro das frases da narrativa, como parte natural do texto.\n' +
  '- A tag SUBSTITUI o texto comum. Ex: em vez de "O ferreiro", escreva "[npc:O ferreiro]". A frase continua normalmente.\n' +
  '- CORRETO: "[npc:O ferreiro] ergue [item:um martelo brilhante] e aponta para [location:a forja ao fundo]."\n' +
  '- ERRADO (lista no final): "A cena se desenrola... [npc:ferreiro] [item:martelo] [location:forja]" — NUNCA faca isso.\n' +
  '- ERRADO (tags agrupadas): "...e varios elementos chamam atencao: [npc:guarda], [item:espada], [location:ponte]." — PROIBIDO.\n' +
  '- PROIBIDO: listar tags no final do texto, agrupar tags em sequencia, ou separar tags da narrativa.\n' +
  '- Cada tag deve aparecer NO MOMENTO em que o elemento e mencionado na acao/descricao.\n' +
  '- MINIMOS OBRIGATORIOS: pelo menos 3 tags de contexto ([npc:], [item:], [location:], [enemy:], [danger:], [lore:], [quest:]) distribuidas ao longo da narrativa + pelo menos 2 tags [choice:] por cena.\n' +
  '- REGRA DE NPCs: so introduza NPCs ([npc:]) se fizerem sentido para a historia, o ato ou a missao atual. NAO invente NPCs aleatorios so para preencher cena.\n' +
  '- TAG [choice:]: OBRIGATORIO pelo menos 2 por cena na narrativa principal. Representam decisoes ou caminhos possiveis para os jogadores.\n' +
  '  As escolhas devem ser DINAMICAS — mudam conforme o contexto narrativo, as acoes anteriores dos jogadores e os resultados dos dados.\n' +
  '  Se o jogador interagiu com outro elemento (um [npc:], [item:], [location:]) em vez de seguir uma [choice:] anterior, as novas escolhas devem REFLETIR essa interacao.\n' +
  '  As escolhas NAO sao fixas — evoluem com a historia.\n\n' +
  'REGRAS RIGIDAS:\n' +
  '1. Responda APENAS com JSON valido. Sem markdown, sem comentarios, sem texto fora do JSON.\n' +
  '2. Siga EXATAMENTE o schema fornecido. Nao adicione campos extras. Nao omita campos.\n' +
  '3. Use as informacoes fornecidas (local, quests, inimigos, equipamentos) como base.\n' +
  '4. Toda narrativa DEVE ser em PORTUGUES DO BRASIL.\n' +
  '5. A "description" DEVE ter entre 600 e 1200 CARACTERES (incluindo as tags). Nem mais, nem menos.\n' +
  '6. Respeite o tom e estilo narrativo do mundo.'

/* ──────────────────────────────────────────────
   Schema
   ────────────────────────────────────────────── */

const SCENE_SCHEMA = `
ESTRUTURA JSON OBRIGATORIA para cenas (siga EXATAMENTE):
{
  "title": string,         // titulo narrativo descritivo (8-15 palavras). Deve resumir o momento da cena e dar contexto de continuidade. Ex: "A negociacao tensa na taverna do porto sob a tempestade", "Os herois descobrem um segredo sombrio nas ruinas ancestrais"
  "description": string,   // narrativa imersiva entre 600 e 1200 CARACTERES. Use \\n para separar paragrafos.
  "mood": string           // clima emocional da cena. VALORES PERMITIDOS: "Neutro" | "Alegre" | "Triste" | "Inspirador" | "Medo" | "Tensão" | "Mistério" | "Sombrio" | "Combate" | "Vitória"
}
`

/* ──────────────────────────────────────────────
   Fallback
   ────────────────────────────────────────────── */

function buildFallbackScene(locationName: string): NarrativeResult {
  return {
    title: `Cena em ${locationName}`,
    description:
      'A atmosfera pesa e cada detalhe importa. O ambiente ao redor revela possibilidades — pessoas, caminhos, objetos. O que desejam fazer?',
    mood: 'Neutro',
  }
}

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Generate the intro narration for when the adventure begins.
 * Presents the world, the first location, and a call to adventure.
 */
export async function narrateIntro(
  ctx: NarrativeContext,
): Promise<NarrativeResult> {
  const { world, location, content, characters, activeQuestIds, equipmentMap } = ctx

  const introBlock = world.introNarrative
    ? `\nNARRATIVA DE INTRODUCAO DO MUNDO (pre-gerada pelo World Architect — use como BASE e EXPANDIR):\n"${world.introNarrative}"\n` +
      'Use este texto como ponto de partida, mas ADAPTE ao cenario atual e aos personagens presentes com tom cinematografico e direto.\n\n'
    : ''

  const firstMission = world.acts?.[0]?.missions?.[0]
  const missionBlock = firstMission
    ? `\nPRIMEIRA MISSAO ATIVA: "${firstMission.title}" — ${firstMission.description}\n` +
      `Direcao narrativa: ${firstMission.narrativeDirection}\n` +
      'Incorpore naturalmente esta missao na narrativa, deixando claro o que os herois devem fazer.\n\n'
    : ''

  const userPrompt =
    buildWorldContext(world, location.id) +
    '\n\n' +
    buildLocationContext(location, content, activeQuestIds) +
    '\n\n' +
    buildPartyContext(characters, equipmentMap) +
    buildOwnedItemsContext(characters, equipmentMap) +
    '\n\n' +
    introBlock +
    missionBlock +
    'TAREFA: Crie a INTRODUCAO NARRATIVA da aventura (primeira cena).\n' +
    `Numero de jogadores: ${characters.length}. ${characters.length === 1 ? 'Use "voce" (singular).' : 'Use "voces" (plural).'}\n` +
    'Como mestre de RPG, narre a cena:\n' +
    '- Descreva o cenario com detalhes sensoriais ricos e imersivos\n' +
    '- Comente o estado dos aventureiros de forma narrativa\n' +
    '- Descreva DETALHADAMENTE o que ha ao redor: pessoas e o que fazem, objetos interessantes, caminhos possiveis, estruturas, sons, cheiros\n' +
    '- Mencione elementos especificos que os jogadores podem escolher investigar ou interagir\n' +
    '- NAO forneca escolhas prontas. Os jogadores vao decidir suas proprias acoes\n' +
    '- Termine com algo que convide a agir ("O que desejam fazer?", "A cena esta posta.")\n' +
    '- LIMITE: description entre 600 e 1200 caracteres\n\n' +
    SCENE_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: STORY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 2000,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<NarrativeResult>(raw)

    if (parsed?.title && parsed?.description) {
      const mood: NarrativeMood = VALID_MOODS.includes(parsed.mood as NarrativeMood)
        ? (parsed.mood as NarrativeMood)
        : 'Neutro'
      return { title: parsed.title, description: parsed.description, mood }
    }

    console.warn('[StoryNarrator] Invalid intro response, using fallback')
  } catch (err) {
    console.error('[StoryNarrator] Intro narration failed:', err)
  }

  return buildFallbackScene(location.name)
}

/**
 * Generate a scene narration for when the player arrives at (or returns to) a location,
 * or after all player actions have been resolved (continuation).
 */
export async function narrateScene(
  ctx: NarrativeContext,
  recentOutcomes?: string[],
): Promise<NarrativeResult> {
  const { world, location, content, characters, previousActions = [], activeQuestIds, previousMood, previousSceneDescription, equipmentMap } = ctx

  const recentLog =
    previousActions.length > 0
      ? '\nAcoes recentes dos jogadores:\n' +
        previousActions.slice(0, 5).map((a) => `  - ${a}`).join('\n')
      : ''

  const moodBlock = previousMood
    ? `\nCLIMA EMOCIONAL ANTERIOR: ${previousMood}. Use como referencia para manter coerencia ou transicionar naturalmente o mood da cena.\n`
    : ''

  const previousSceneBlock = previousSceneDescription
    ? '\n\nCENA ANTERIOR (contexto completo do que foi narrado — NAO repita, apenas CONTINUE a partir daqui):\n' +
      `"${previousSceneDescription.slice(0, 1500)}"\n`
    : ''

  const outcomesBlock =
    recentOutcomes && recentOutcomes.length > 0
      ? '\n\nRESULTADOS DAS ACOES DOS JOGADORES (OBRIGATORIO considerar na narrativa):\n' +
        recentOutcomes.map((o) => `  - ${o}`).join('\n') +
        '\n\n' +
        'INSTRUCOES CRITICAS PARA CONTINUACAO:\n' +
        '- Esta e uma CONTINUACAO. NAO repita a cena anterior. NAO descreva novamente o que ja foi narrado.\n' +
        '- Voce tem o contexto COMPLETO da cena anterior acima. CONTINUE a historia a partir dali.\n' +
        '- CADA JOGADOR tem um resultado individual. Narre NATURALMENTE o que aconteceu com cada um e como afetou o ambiente.\n' +
        '- REGRA INVIOLAVEL: Se um jogador teve FALHA nos dados, a narrativa DEVE mostrar que ELE FALHOU. Se teve SUCESSO, DEVE mostrar que ELE TEVE SUCESSO.\n' +
        '- PROIBIDO: narrar que um jogador "conseguiu" algo quando o resumo acima diz que ele teve FALHA. Verifique CADA resultado individualmente.\n' +
        '- Em caso de resultados mistos (um jogador falhou, outro teve sucesso), mostre AMBOS — o fracasso de um e a conquista do outro.\n' +
        '- Narre tudo como PROSA FLUIDA. PROIBIDO usar rotulos como "CONSEQUENCIAS:", "RESULTADO:", "CENARIO:" no texto. Apenas conte a historia.\n' +
        '- A partir do que aconteceu, introduza NOVOS acontecimentos e elementos interagiveis — NPCs reagindo, objetos revelados, caminhos abertos/fechados, novos perigos.\n' +
        '- Quanto MAIOR a dificuldade da acao, MAIORES as mudancas no mundo (positivas ou negativas conforme o resultado dos dados).\n' +
        '- PROPORCIONALIDADE DIFICULDADE x CONSEQUENCIA (REGRA CRITICA):\n' +
        '  * Acao de ALTA dificuldade (15-20): SUCESSO = recompensa grande, alianca forte, revelacao importante. FALHA = consequencia grave, perigo real, inimigos alertados.\n' +
        '  * Acao de MEDIA dificuldade (10-14): SUCESSO = avanço claro. FALHA = complicação moderada.\n' +
        '  * Acao de BAIXA dificuldade (5-9): SUCESSO = ganho menor, avanço incremental. FALHA = contratempo leve, nada catastrófico.\n' +
        '  * FALHA CRITICA: sempre dramatica, mas PROPORCIONALMENTE pior em acoes dificeis.\n' +
        '  * SUCESSO CRITICO: sempre espetacular, mas PROPORCIONALMENTE melhor em acoes dificeis.\n' +
        '- Os novos elementos devem surgir NATURALMENTE das consequencias. Se alguem falhou ao convencer um guarda, o guarda pode chamar reforcos. Se alguem abriu uma porta, mostre o que ha do outro lado.\n' +
        '- TAGS: embutir [npc:], [item:], [location:], [enemy:], [danger:], [quest:], [lore:], [choice:] DENTRO das frases. NUNCA listar agrupadas ou no final.\n' +
        '- MINIMOS: pelo menos 3 tags de contexto + pelo menos 2 [choice:] com decisoes/caminhos que surgiram das consequencias.\n' +
        '- As [choice:] devem refletir o NOVO estado do mundo apos as acoes. Se um jogador interagiu com um NPC ou item em vez de seguir uma escolha anterior, as novas escolhas devem partir dessa interacao.\n'
      : ''

  const userPrompt =
    buildWorldContext(world, location.id) +
    '\n\n' +
    buildLocationContext(location, content, activeQuestIds) +
    '\n\n' +
    buildPartyContext(characters, equipmentMap) +
    buildOwnedItemsContext(characters, equipmentMap) +
    recentLog +
    previousSceneBlock +
    outcomesBlock +
    moodBlock +
    '\n\n' +
    'TAREFA: Narre a cena atual neste local como mestre de RPG.\n' +
    `Numero de jogadores: ${characters.length}. ${characters.length === 1 ? 'Use "voce" (singular).' : 'Use "voces" (plural).'}\n` +
    'A narrativa deve fluir como PROSA NATURAL, sem rotulos ou titulos de secao. PROIBIDO escrever "CONSEQUENCIAS:", "CENARIO:", "RESULTADO:" ou qualquer rotulo no texto.\n' +
    'Organize o fluxo assim (tudo em prosa continua, sem rotulos):\n' +
    '- Se houve acoes dos jogadores, comece narrando NATURALMENTE o que aconteceu com CADA jogador e como isso afetou o ambiente ao redor deles. Mostre o resultado concreto de cada um e como o mundo reagiu.\n' +
    '- Na sequencia, descreva como o ambiente esta AGORA — o que mudou, o que apareceu, como as pessoas ao redor reagiram. 2-3 detalhes visuais.\n' +
    '- Apresente NOVOS acontecimentos que surgiram a partir das consequencias — NPCs reagindo, novos objetos, caminhos abertos/fechados, sons, movimentos. Quanto maior a dificuldade das acoes, maiores as mudancas no mundo. Pelo menos 2 elementos novos para os jogadores interagirem.\n' +
    '- Embutir TAGS dentro das frases (nunca listar no final): [npc:], [item:], [location:], [enemy:], [danger:], [quest:], [lore:]\n' +
    '- NAO forneca escolhas prontas. Os jogadores vao decidir suas proprias acoes\n' +
    '- Termine com uma frase curta que convide a agir\n' +
    '- LIMITE: description entre 600 e 1200 caracteres\n' +
    (previousActions.length > 0
      ? '- Considere as acoes anteriores para continuidade narrativa\n'
      : '') +
    (recentOutcomes && recentOutcomes.length > 0
      ? '- FUNDAMENTAL: A narrativa DEVE refletir os resultados das acoes, mas como prosa NATURAL — sem rotulos. Narre o que aconteceu e o que surgiu de novo. AVANCE a historia.\n' +
        '- Descreva o NOVO estado do ambiente apos as acoes. Novos NPCs, objetos revelados, caminhos abertos/fechados.\n' +
        '- TAGS embutidas nas frases (NUNCA listar no final): [npc:], [item:], [location:], [enemy:], [danger:], [quest:], [lore:], [choice:]\n' +
        '- MINIMOS: pelo menos 3 tags de contexto + pelo menos 2 [choice:] com decisoes/caminhos surgidos das consequencias. As escolhas evoluem conforme as acoes dos jogadores.\n'
      : '') +
    SCENE_SCHEMA

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: STORY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxCompletionTokens: 1500,
      reasoningEffort: 'low',
    })

    const raw = extractContent(response as Record<string, unknown>)
    const parsed = parseJsonPayload<NarrativeResult>(raw)

    if (parsed?.title && parsed?.description) {
      const mood: NarrativeMood = VALID_MOODS.includes(parsed.mood as NarrativeMood)
        ? (parsed.mood as NarrativeMood)
        : 'Neutro'
      return { title: parsed.title, description: parsed.description, mood }
    }

    console.warn('[StoryNarrator] Invalid scene response, using fallback')
  } catch (err) {
    console.error('[StoryNarrator] Scene narration failed:', err)
  }

  return buildFallbackScene(location.name)
}
