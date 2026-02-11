import type { Act, Location, LocationContent, World } from './types'

export type WorldBlueprint = {
  world: World
  locations: Location[]
}

export function buildSeedWorld(_adventureTitle: string): WorldBlueprint {
  const worldId = `world-${crypto?.randomUUID?.() ?? Date.now()}`
  const locId1 = `${worldId}-loc-1`
  const locId2 = `${worldId}-loc-2`
  const locId3 = `${worldId}-loc-3`
  const actId1 = `${worldId}-act-1`
  const actId2 = `${worldId}-act-2`
  const actId3 = `${worldId}-act-3`
  const acts: Act[] = [
    {
      id: actId1,
      title: 'Ato 1 - Sinais do passado',
      goal: 'Descobrir o motivo do chamado inicial.',
      linkedLocations: [{ id: locId1 }, { id: locId2 }],
    },
    {
      id: actId2,
      title: 'Ato 2 - Corrida contra o tempo',
      goal: 'Reunir aliados e desvendar o artefato central.',
      linkedLocations: [{ id: locId2 }, { id: locId3 }],
    },
    {
      id: actId3,
      title: 'Ato 3 - Decisao final',
      goal: 'Enfrentar a ameaca e decidir o destino do mundo.',
      linkedLocations: [{ id: locId3 }],
    },
  ]

  const locations: Location[] = [
    {
      id: locId1,
      worldId,
      name: 'Distrito Central',
      type: 'hub urbano',
      dangerLevel: 2,
      storyRelevance: 'main',
      linkedActs: [{ id: actId1 }],
    },
    {
      id: locId2,
      worldId,
      name: 'Docas Submersas',
      type: 'zona de risco',
      dangerLevel: 4,
      storyRelevance: 'main',
      linkedActs: [{ id: actId1 }, { id: actId2 }],
    },
    {
      id: locId3,
      worldId,
      name: 'Torre do Nucleo',
      type: 'fortaleza',
      dangerLevel: 5,
      storyRelevance: 'main',
      linkedActs: [{ id: actId2 }, { id: actId3 }],
    },
  ]

  const world: World = {
    id: worldId,
    title: 'Ecos do Abismo',
    genre: 'misterio',
    tone: 'sombrio e esperancoso',
    synopsis:
      'Uma cidade afundada esconde um mecanismo que reescreve memorias.',
    acts,
    locations: locations.map((location) => ({ id: location.id })),
    finalObjective: 'Selar a fonte que altera as memorias do mundo.',
    createdAt: new Date().toISOString(),
  }

  return { world, locations }
}

export function buildSeedLocationContent(location: Location): LocationContent {
  return {
    id: `content-${location.id}`,
    locationId: location.id,
    npcs: [
      {
        id: `${location.id}-npc-1`,
        name: 'Guia da Memoria',
        role: 'mentor',
        description: 'Conhece os ecos do local e oferece direcao inicial.',
        narrativeEffect: 'Revela pistas sobre os segredos escondidos no local.',
      },
      {
        id: `${location.id}-npc-2`,
        name: 'Mercador Errante',
        role: 'comerciante',
        description: 'Um viajante que coleta e vende reliquias do local.',
        narrativeEffect: 'Oferece itens unicos e troca informacoes por ouro.',
      },
      {
        id: `${location.id}-npc-3`,
        name: 'Sentinela Silenciosa',
        role: 'guarda',
        description: 'Vigia a entrada do local com expressao impassivel.',
        narrativeEffect: 'Pode revelar passagens secretas se convencida.',
      },
    ],
    quests: {
      main: [
        {
          id: `${location.id}-quest-main-1`,
          title: 'Ecos esquecidos',
          type: 'main',
          description: 'Recuperar um fragmento crucial para o ato atual.',
          narrativeEffect: 'Avanca a trama principal do ato.',
        },
      ],
      side: [
        {
          id: `${location.id}-quest-side-1`,
          title: 'Rota alternativa',
          type: 'side',
          description: 'Investigar uma pista paralela na area.',
          narrativeEffect: 'Desbloqueia um caminho mais seguro.',
        },
        {
          id: `${location.id}-quest-side-2`,
          title: 'Coleta de reliquias',
          type: 'side',
          description: 'Encontrar objetos antigos espalhados pelo local.',
          narrativeEffect: 'Recompensa o jogador com itens uteis.',
        },
      ],
      ambient: [
        {
          id: `${location.id}-quest-ambient-1`,
          title: 'Sussurros do lugar',
          type: 'ambient',
          description: 'Interpretar sinais sutis do ambiente.',
          narrativeEffect: 'Aprofunda a imersao no mundo.',
        },
        {
          id: `${location.id}-quest-ambient-2`,
          title: 'Memorias gravadas',
          type: 'ambient',
          description: 'Decifrar inscricoes antigas nas paredes.',
          narrativeEffect: 'Revela fragmentos da historia do local.',
        },
      ],
    },
    enemies: [
      {
        id: `${location.id}-enemy-1`,
        name: 'Vigia Afogado',
        description: 'Uma criatura palida que emerge das sombras com garras rapidas.',
        narrativeEffect: 'Ataca em ondas curtas e recua para as profundezas.',
      },
      {
        id: `${location.id}-enemy-2`,
        name: 'Eco Distorcido',
        description: 'Uma forma translucida que repete memorias fragmentadas.',
        narrativeEffect: 'Confunde os sentidos do jogador com ilusoes.',
      },
    ],
    items: [
      {
        id: `${location.id}-item-1`,
        name: 'Lanterna de Neblina',
        type: 'ferramenta',
        description: 'Revela caminhos ocultos no local.',
        narrativeEffect: 'Uma luz suave corta a neblina revelando passagens secretas.',
      },
      {
        id: `${location.id}-item-2`,
        name: 'Pocao de Clareza',
        type: 'pocao',
        description: 'Restaura a mente e afasta confusao.',
        narrativeEffect: 'Uma onda de lucidez percorre o corpo ao beber.',
      },
      {
        id: `${location.id}-item-3`,
        name: 'Fragmento de Memoria',
        type: 'material',
        description: 'Um cristal que pulsa com uma lembranca antiga.',
        narrativeEffect: 'Ao tocar, uma visao do passado surge brevemente.',
      },
      {
        id: `${location.id}-item-4`,
        name: 'Adaga Enferrujada',
        type: 'arma',
        description: 'Uma arma antiga mas ainda afiada.',
        narrativeEffect: 'A lamina vibra levemente ao ser empunhada.',
      },
    ],
    narrativeImpact: 'O local reflete as escolhas recentes do jogador.',
  }
}
