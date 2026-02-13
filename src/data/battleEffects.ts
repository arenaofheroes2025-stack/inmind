/**
 * Battle Status Effects — predefined catalog of all status effects
 * that can be applied during tactical battles.
 *
 * Each effect has visual (icon, color) and mechanical (damage, modifiers) properties.
 * Effects can stack (poison, bleed) or replace (buffs of same type).
 */

import type { StatusEffect } from './types'

/* ──────────────────────────────────────────────
   Effect Templates (duration/stacks set at apply time)
   ────────────────────────────────────────────── */

function ef(partial: Omit<StatusEffect, 'currentStacks'>): StatusEffect {
  return { ...partial, currentStacks: partial.stackable ? 1 : undefined }
}

/** All pre-defined status effects indexed by ID */
export const STATUS_EFFECTS: Record<string, StatusEffect> = {
  /* ── Damage over Time (DoT) ── */
  queimadura: ef({
    id: 'queimadura',
    name: 'Queimadura',
    icon: 'flame',
    type: 'dot',
    color: '#ef4444',
    damagePerTurn: 4,
    duration: 3,
    stackable: false,
  }),
  envenenado: ef({
    id: 'envenenado',
    name: 'Envenenado',
    icon: 'skull',
    type: 'dot',
    color: '#a855f7',
    damagePerTurn: 3,
    duration: 4,
    stackable: true,
    maxStacks: 3,
  }),
  sangramento: ef({
    id: 'sangramento',
    name: 'Sangramento',
    icon: 'droplets',
    type: 'dot',
    color: '#dc2626',
    damagePerTurn: 2,
    duration: 3,
    stackable: true,
    maxStacks: 3,
  }),
  eletrificado: ef({
    id: 'eletrificado',
    name: 'Eletrificado',
    icon: 'zap',
    type: 'dot',
    color: '#eab308',
    damagePerTurn: 2,
    attribute: 'defesa',
    percentModifier: -20,
    duration: 2,
    stackable: false,
  }),

  /* ── Heal over Time (HoT) ── */
  regeneracao: ef({
    id: 'regeneracao',
    name: 'Regeneração',
    icon: 'heart',
    type: 'hot',
    color: '#22c55e',
    healPerTurn: 3,
    duration: 3,
    stackable: false,
  }),

  /* ── Buffs ── */
  ataque_up: ef({
    id: 'ataque_up',
    name: 'Ataque+',
    icon: 'sword',
    type: 'buff',
    color: '#f97316',
    attribute: 'ataque',
    percentModifier: 40,
    duration: 3,
    stackable: false,
  }),
  defesa_up: ef({
    id: 'defesa_up',
    name: 'Defesa+',
    icon: 'shield',
    type: 'buff',
    color: '#3b82f6',
    attribute: 'defesa',
    percentModifier: 40,
    duration: 3,
    stackable: false,
  }),
  velocidade_up: ef({
    id: 'velocidade_up',
    name: 'Velocidade+',
    icon: 'arrow-up',
    type: 'buff',
    color: '#22c55e',
    attribute: 'velocidade',
    percentModifier: 30,
    duration: 2,
    stackable: false,
  }),
  magia_up: ef({
    id: 'magia_up',
    name: 'Magia+',
    icon: 'sparkles',
    type: 'buff',
    color: '#8b5cf6',
    attribute: 'magia',
    percentModifier: 40,
    duration: 3,
    stackable: false,
  }),

  /* ── Debuffs ── */
  ataque_down: ef({
    id: 'ataque_down',
    name: 'Ataque-',
    icon: 'arrow-down',
    type: 'debuff',
    color: '#6b7280',
    attribute: 'ataque',
    percentModifier: -30,
    duration: 2,
    stackable: false,
  }),
  defesa_down: ef({
    id: 'defesa_down',
    name: 'Defesa-',
    icon: 'shield-off',
    type: 'debuff',
    color: '#6b7280',
    attribute: 'defesa',
    percentModifier: -30,
    duration: 2,
    stackable: false,
  }),
  congelamento: ef({
    id: 'congelamento',
    name: 'Congelamento',
    icon: 'snowflake',
    type: 'debuff',
    color: '#38bdf8',
    attribute: 'velocidade',
    percentModifier: -30,
    duration: 2,
    stackable: false,
  }),

  /* ── Control ── */
  atordoado: ef({
    id: 'atordoado',
    name: 'Atordoado',
    icon: 'circle-slash',
    type: 'control',
    color: '#eab308',
    duration: 1,
    stackable: false,
  }),
  enraizado: ef({
    id: 'enraizado',
    name: 'Enraizado',
    icon: 'anchor',
    type: 'control',
    color: '#92400e',
    duration: 2,
    stackable: false,
  }),
}

/**
 * Create a fresh copy of a status effect template for applying to a combatant.
 * Optionally override duration or damage values.
 */
export function createStatusEffect(
  effectId: string,
  overrides?: Partial<Pick<StatusEffect, 'duration' | 'damagePerTurn' | 'healPerTurn' | 'percentModifier' | 'value'>>,
): StatusEffect | null {
  const template = STATUS_EFFECTS[effectId]
  if (!template) return null
  return {
    ...template,
    currentStacks: template.stackable ? 1 : undefined,
    ...overrides,
  }
}
