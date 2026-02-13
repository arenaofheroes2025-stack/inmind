/**
 * Battle Skills Catalog — 6 skills per archetype, unlocked by character level.
 *
 * Skills evolve with use: every X uses in battle, the skill levels up (1→5).
 * Each level increases damage/healing by ~15%.
 *
 * Unlock schedule:
 *   Lv1: skills 1-2  |  Lv3: skill 3  |  Lv5: skill 4  |  Lv7: skill 5  |  Lv10: skill 6
 *
 * Level-up thresholds (usageCount):
 *   Lv1→2: 5 uses  |  Lv2→3: 15  |  Lv3→4: 30  |  Lv4→5: 50
 */

import type { BattleSkill } from './types'

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function skill(partial: Omit<BattleSkill, 'currentUses' | 'usageCount' | 'level' | 'levelUpThreshold' | 'apCost'>): BattleSkill {
  return {
    ...partial,
    apCost: 1,
    currentUses: partial.maxUsesPerBattle,
    usageCount: 0,
    level: 1,
    levelUpThreshold: 5,
  }
}

/** Get the level-up threshold for the NEXT level */
export function getSkillLevelUpThreshold(currentLevel: number): number {
  switch (currentLevel) {
    case 1: return 5
    case 2: return 15
    case 3: return 30
    case 4: return 50
    default: return Infinity // max level
  }
}

/** Calculate damage/healing multiplier based on skill level */
export function getSkillLevelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.15 // Lv1=1.0, Lv2=1.15, Lv3=1.30, Lv4=1.45, Lv5=1.60
}

/* ──────────────────────────────────────────────
   Skills per Archetype
   ────────────────────────────────────────────── */

const GUERREIRO: BattleSkill[] = [
  // Unlock: Lv1
  skill({
    id: 'guerreiro-golpe-poderoso', name: 'Golpe Poderoso', archetype: 'Guerreiro',
    description: 'Um golpe devastador com força total.',
    type: 'ataque', element: 'fisico', range: 1, aoeRadius: 0, maxUsesPerBattle: 3,
    damage: { base: 8, attribute: 'ataque', scaling: 1.2 },
  }),
  skill({
    id: 'guerreiro-postura-defensiva', name: 'Postura Defensiva', archetype: 'Guerreiro',
    description: 'Assume postura que aumenta defesa do grupo próximo.',
    type: 'buff', element: 'fisico', range: 0, aoeRadius: 1, maxUsesPerBattle: 2,
    statusApply: { effectId: 'defesa_up', chance: 1 },
  }),
  // Unlock: Lv3
  skill({
    id: 'guerreiro-investida', name: 'Investida', archetype: 'Guerreiro',
    description: 'Avança 2 tiles e ataca o alvo com impulso.',
    type: 'ataque', element: 'fisico', range: 2, aoeRadius: 0, maxUsesPerBattle: 2,
    damage: { base: 10, attribute: 'ataque', scaling: 1.0 },
  }),
  // Unlock: Lv5
  skill({
    id: 'guerreiro-provocar', name: 'Provocar', archetype: 'Guerreiro',
    description: 'Provoca inimigos próximos, reduzindo seu ataque.',
    type: 'debuff', element: 'fisico', range: 1, aoeRadius: 1, maxUsesPerBattle: 2,
    statusApply: { effectId: 'ataque_down', chance: 0.8 },
  }),
  // Unlock: Lv7
  skill({
    id: 'guerreiro-golpe-giratorio', name: 'Golpe Giratório', archetype: 'Guerreiro',
    description: 'Gira a arma atingindo todos os inimigos adjacentes.',
    type: 'aoe', element: 'fisico', range: 1, aoeRadius: 1, maxUsesPerBattle: 1,
    damage: { base: 6, attribute: 'ataque', scaling: 0.8 },
    statusApply: { effectId: 'sangramento', chance: 0.4 },
  }),
  // Unlock: Lv10
  skill({
    id: 'guerreiro-grito-de-guerra', name: 'Grito de Guerra', archetype: 'Guerreiro',
    description: 'Grito que inspira aliados, aumentando ataque de todos.',
    type: 'buff', element: 'fisico', range: 0, aoeRadius: 99, maxUsesPerBattle: 1,
    statusApply: { effectId: 'ataque_up', chance: 1 },
  }),
]

const MAGO: BattleSkill[] = [
  skill({
    id: 'mago-misseis-magicos', name: 'Mísseis Mágicos', archetype: 'Mago',
    description: 'Projéteis arcanos que perseguem o alvo.',
    type: 'ataque', element: 'arcano', range: 3, aoeRadius: 0, maxUsesPerBattle: 3,
    damage: { base: 7, attribute: 'magia', scaling: 1.0 },
  }),
  skill({
    id: 'mago-escudo-arcano', name: 'Escudo Arcano', archetype: 'Mago',
    description: 'Barreira mágica que aumenta defesa.',
    type: 'buff', element: 'arcano', range: 2, aoeRadius: 0, maxUsesPerBattle: 2,
    statusApply: { effectId: 'defesa_up', chance: 1 },
  }),
  skill({
    id: 'mago-bola-de-fogo', name: 'Bola de Fogo', archetype: 'Mago',
    description: 'Explosão flamejante que atinge uma área.',
    type: 'aoe', element: 'fogo', range: 3, aoeRadius: 1, maxUsesPerBattle: 2,
    damage: { base: 6, attribute: 'magia', scaling: 0.9 },
    statusApply: { effectId: 'queimadura', chance: 0.5 },
  }),
  skill({
    id: 'mago-raio-gelido', name: 'Raio Gélido', archetype: 'Mago',
    description: 'Raio congelante que reduz velocidade do alvo.',
    type: 'ataque', element: 'gelo', range: 3, aoeRadius: 0, maxUsesPerBattle: 2,
    damage: { base: 5, attribute: 'magia', scaling: 0.8 },
    statusApply: { effectId: 'congelamento', chance: 0.7 },
  }),
  skill({
    id: 'mago-tempestade-eletrica', name: 'Tempestade Elétrica', archetype: 'Mago',
    description: 'Raios que atingem todos os inimigos numa grande área.',
    type: 'aoe', element: 'raio', range: 3, aoeRadius: 2, maxUsesPerBattle: 1,
    damage: { base: 5, attribute: 'magia', scaling: 0.7 },
    statusApply: { effectId: 'eletrificado', chance: 0.6 },
  }),
  skill({
    id: 'mago-teleporte', name: 'Teleporte', archetype: 'Mago',
    description: 'Teleporta para qualquer tile livre no campo de batalha.',
    type: 'controle', element: 'arcano', range: 99, aoeRadius: 0, maxUsesPerBattle: 1,
  }),
]

const LADINO: BattleSkill[] = [
  skill({
    id: 'ladino-ataque-furtivo', name: 'Ataque Furtivo', archetype: 'Ladino',
    description: 'Golpe preciso que causa dano extra.',
    type: 'ataque', element: 'fisico', range: 1, aoeRadius: 0, maxUsesPerBattle: 3,
    damage: { base: 10, attribute: 'ataque', scaling: 1.3 },
  }),
  skill({
    id: 'ladino-lanca-veneno', name: 'Lança Veneno', archetype: 'Ladino',
    description: 'Arremessa frasco venenoso no alvo.',
    type: 'ataque', element: 'sombrio', range: 2, aoeRadius: 0, maxUsesPerBattle: 2,
    damage: { base: 3, attribute: 'ataque', scaling: 0.5 },
    statusApply: { effectId: 'envenenado', chance: 0.8 },
  }),
  skill({
    id: 'ladino-evasao', name: 'Evasão', archetype: 'Ladino',
    description: 'Aumenta velocidade para esquivar ataques.',
    type: 'buff', element: 'fisico', range: 0, aoeRadius: 0, maxUsesPerBattle: 2,
    statusApply: { effectId: 'velocidade_up', chance: 1 },
  }),
  skill({
    id: 'ladino-golpe-sangrento', name: 'Golpe Sangrento', archetype: 'Ladino',
    description: 'Corte profundo que causa sangramento.',
    type: 'ataque', element: 'fisico', range: 1, aoeRadius: 0, maxUsesPerBattle: 2,
    damage: { base: 5, attribute: 'ataque', scaling: 0.8 },
    statusApply: { effectId: 'sangramento', chance: 0.7 },
  }),
  skill({
    id: 'ladino-sombra', name: 'Manto de Sombras', archetype: 'Ladino',
    description: 'Envolve-se em sombras, reduzindo ataque dos inimigos próximos.',
    type: 'debuff', element: 'sombrio', range: 1, aoeRadius: 1, maxUsesPerBattle: 1,
    statusApply: { effectId: 'ataque_down', chance: 0.9 },
  }),
  skill({
    id: 'ladino-assassinato', name: 'Golpe Mortal', archetype: 'Ladino',
    description: 'Golpe devastador contra alvos com HP baixo.',
    type: 'ataque', element: 'fisico', range: 1, aoeRadius: 0, maxUsesPerBattle: 1,
    damage: { base: 18, attribute: 'ataque', scaling: 1.5 },
  }),
]

const CLERIGO: BattleSkill[] = [
  skill({
    id: 'clerigo-cura-menor', name: 'Cura Menor', archetype: 'Clérigo',
    description: 'Cura um aliado com energia sagrada.',
    type: 'cura', element: 'sagrado', range: 2, aoeRadius: 0, maxUsesPerBattle: 3,
    healing: 8,
  }),
  skill({
    id: 'clerigo-golpe-sagrado', name: 'Golpe Sagrado', archetype: 'Clérigo',
    description: 'Ataque imbuído de luz sagrada.',
    type: 'ataque', element: 'sagrado', range: 1, aoeRadius: 0, maxUsesPerBattle: 3,
    damage: { base: 6, attribute: 'magia', scaling: 0.9 },
  }),
  skill({
    id: 'clerigo-bencao', name: 'Bênção', archetype: 'Clérigo',
    description: 'Abençoa aliados próximos, aumentando ataque.',
    type: 'buff', element: 'sagrado', range: 0, aoeRadius: 1, maxUsesPerBattle: 2,
    statusApply: { effectId: 'ataque_up', chance: 1 },
  }),
  skill({
    id: 'clerigo-purificar', name: 'Purificar', archetype: 'Clérigo',
    description: 'Remove todos os efeitos negativos de um aliado.',
    type: 'cura', element: 'sagrado', range: 2, aoeRadius: 0, maxUsesPerBattle: 2,
    healing: 3,
  }),
  skill({
    id: 'clerigo-regeneracao', name: 'Regeneração', archetype: 'Clérigo',
    description: 'Aplica cura contínua a um aliado.',
    type: 'cura', element: 'sagrado', range: 2, aoeRadius: 0, maxUsesPerBattle: 1,
    healing: 2,
    statusApply: { effectId: 'regeneracao', chance: 1 },
  }),
  skill({
    id: 'clerigo-cura-divina', name: 'Cura Divina', archetype: 'Clérigo',
    description: 'Cura poderosa que restaura HP de todos os aliados na área.',
    type: 'cura', element: 'sagrado', range: 0, aoeRadius: 99, maxUsesPerBattle: 1,
    healing: 12,
  }),
]

const RANGER: BattleSkill[] = [
  skill({
    id: 'ranger-tiro-preciso', name: 'Tiro Preciso', archetype: 'Ranger',
    description: 'Disparo certeiro de longa distância.',
    type: 'ataque', element: 'fisico', range: 4, aoeRadius: 0, maxUsesPerBattle: 3,
    damage: { base: 7, attribute: 'ataque', scaling: 1.1 },
  }),
  skill({
    id: 'ranger-armadilha', name: 'Armadilha', archetype: 'Ranger',
    description: 'Coloca armadilha que enraíza inimigos.',
    type: 'controle', element: 'fisico', range: 2, aoeRadius: 0, maxUsesPerBattle: 2,
    statusApply: { effectId: 'enraizado', chance: 0.8 },
  }),
  skill({
    id: 'ranger-flecha-flamejante', name: 'Flecha Flamejante', archetype: 'Ranger',
    description: 'Flecha com ponta incendiária.',
    type: 'ataque', element: 'fogo', range: 3, aoeRadius: 0, maxUsesPerBattle: 2,
    damage: { base: 5, attribute: 'ataque', scaling: 0.8 },
    statusApply: { effectId: 'queimadura', chance: 0.6 },
  }),
  skill({
    id: 'ranger-chuva-de-flechas', name: 'Chuva de Flechas', archetype: 'Ranger',
    description: 'Dispara múltiplas flechas numa área.',
    type: 'aoe', element: 'fisico', range: 3, aoeRadius: 1, maxUsesPerBattle: 2,
    damage: { base: 4, attribute: 'ataque', scaling: 0.6 },
  }),
  skill({
    id: 'ranger-olhar-aguia', name: 'Olhar de Águia', archetype: 'Ranger',
    description: 'Concentra-se para aumentar precisão e ataque.',
    type: 'buff', element: 'fisico', range: 0, aoeRadius: 0, maxUsesPerBattle: 1,
    statusApply: { effectId: 'ataque_up', chance: 1 },
  }),
  skill({
    id: 'ranger-tiro-perfurante', name: 'Tiro Perfurante', archetype: 'Ranger',
    description: 'Disparo que ignora parte da defesa do alvo.',
    type: 'ataque', element: 'fisico', range: 4, aoeRadius: 0, maxUsesPerBattle: 1,
    damage: { base: 14, attribute: 'ataque', scaling: 1.4 },
  }),
]

const BARDO: BattleSkill[] = [
  skill({
    id: 'bardo-inspiracao', name: 'Inspiração', archetype: 'Bardo',
    description: 'Música que aumenta ataque de aliados próximos.',
    type: 'buff', element: 'arcano', range: 0, aoeRadius: 2, maxUsesPerBattle: 3,
    statusApply: { effectId: 'ataque_up', chance: 1 },
  }),
  skill({
    id: 'bardo-nota-dissonante', name: 'Nota Dissonante', archetype: 'Bardo',
    description: 'Som que atordoa o inimigo.',
    type: 'controle', element: 'arcano', range: 2, aoeRadius: 0, maxUsesPerBattle: 2,
    damage: { base: 3, attribute: 'magia', scaling: 0.5 },
    statusApply: { effectId: 'atordoado', chance: 0.7 },
  }),
  skill({
    id: 'bardo-cancao-cura', name: 'Canção de Cura', archetype: 'Bardo',
    description: 'Melodia que regenera aliados na área.',
    type: 'cura', element: 'arcano', range: 0, aoeRadius: 2, maxUsesPerBattle: 2,
    healing: 5,
    statusApply: { effectId: 'regeneracao', chance: 0.5 },
  }),
  skill({
    id: 'bardo-canto-debilitante', name: 'Canto Debilitante', archetype: 'Bardo',
    description: 'Canto que reduz defesa dos inimigos.',
    type: 'debuff', element: 'arcano', range: 2, aoeRadius: 1, maxUsesPerBattle: 2,
    statusApply: { effectId: 'defesa_down', chance: 0.7 },
  }),
  skill({
    id: 'bardo-aria-velocidade', name: 'Ária da Velocidade', archetype: 'Bardo',
    description: 'Aumenta velocidade de todos os aliados.',
    type: 'buff', element: 'arcano', range: 0, aoeRadius: 99, maxUsesPerBattle: 1,
    statusApply: { effectId: 'velocidade_up', chance: 1 },
  }),
  skill({
    id: 'bardo-requiem', name: 'Réquiem', archetype: 'Bardo',
    description: 'Melodia sombria que drena vida dos inimigos na área.',
    type: 'aoe', element: 'sombrio', range: 2, aoeRadius: 2, maxUsesPerBattle: 1,
    damage: { base: 5, attribute: 'magia', scaling: 0.7 },
    healing: 3,
  }),
]

/* ──────────────────────────────────────────────
   Registry
   ────────────────────────────────────────────── */

/** Map of archetype name (lowercase) → skills array */
export const ARCHETYPE_SKILLS: Record<string, BattleSkill[]> = {
  guerreiro: GUERREIRO,
  mago: MAGO,
  ladino: LADINO,
  'clérigo': CLERIGO,
  clerigo: CLERIGO,
  ranger: RANGER,
  bardo: BARDO,
}

/** Common aliases that map to canonical archetypes */
const ARCHETYPE_ALIASES: Record<string, string> = {
  fighter: 'guerreiro', warrior: 'guerreiro', cavaleiro: 'guerreiro', paladino: 'guerreiro', barbaro: 'guerreiro',
  wizard: 'mago', mage: 'mago', feiticeiro: 'mago', bruxo: 'mago', necromante: 'mago',
  rogue: 'ladino', thief: 'ladino', assassino: 'ladino', gatuno: 'ladino',
  cleric: 'clerigo', priest: 'clerigo', curandeiro: 'clerigo', monge: 'clerigo', sacerdote: 'clerigo',
  archer: 'ranger', cacador: 'ranger', druida: 'ranger', explorador: 'ranger',
  bard: 'bardo', menestrel: 'bardo', trovador: 'bardo',
}

/**
 * Get battle skills available for a character based on their archetype and level.
 * Returns fresh copies with currentUses reset to max.
 *
 * Unlock schedule: Lv1→skills 1-2, Lv3→skill 3, Lv5→skill 4, Lv7→skill 5, Lv10→skill 6
 */
export function getSkillsForCharacter(archetype: string, level: number): BattleSkill[] {
  const key = archetype.toLowerCase()
  const canonical = ARCHETYPE_ALIASES[key] ?? key
  const pool = ARCHETYPE_SKILLS[canonical]
  if (!pool) {
    // Unknown archetype: give generic warrior skills as fallback
    return getSkillsForCharacter('guerreiro', level)
  }

  const unlockThresholds = [1, 1, 3, 5, 7, 10]
  return pool
    .filter((_, i) => level >= unlockThresholds[i])
    .map((s) => ({ ...s, currentUses: s.maxUsesPerBattle }))
}

/**
 * Merge persisted skill data (usageCount, level) with the catalog template.
 * Used when loading a character's saved battleSkills.
 */
export function mergePersistedSkills(
  archetype: string,
  level: number,
  persisted: BattleSkill[],
): BattleSkill[] {
  const fresh = getSkillsForCharacter(archetype, level)
  const persistedMap = new Map(persisted.map((s) => [s.id, s]))

  return fresh.map((s) => {
    const saved = persistedMap.get(s.id)
    if (saved) {
      return {
        ...s,
        usageCount: saved.usageCount,
        level: saved.level,
        levelUpThreshold: saved.levelUpThreshold,
        currentUses: s.maxUsesPerBattle, // always reset for new battle
      }
    }
    return s
  })
}
