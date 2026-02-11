import { useState, useRef, useEffect, type ReactNode } from 'react'

/* ═══════════════════════════════════════════════
   NARRATIVE TAG SYSTEM
   Tags in AI narration:  [tag:texto visivel]
   Each tag category gets a distinct color + subtle
   background pill so players can spot key elements.
   ═══════════════════════════════════════════════ */

export type TagCategory =
  | 'npc'
  | 'enemy'
  | 'item'
  | 'location'
  | 'quest'
  | 'danger'
  | 'lore'
  | 'skill'
  | 'choice'

const TAG_LABELS: Record<TagCategory, string> = {
  npc: 'Personagem',
  enemy: 'Inimigo',
  item: 'Item',
  location: 'Local',
  quest: 'Missão',
  danger: 'Perigo',
  lore: 'Conhecimento',
  skill: 'Habilidade',
  choice: 'Escolha',
}

export const TAG_STYLES: Record<TagCategory, { text: string; bg: string; border: string; icon: string }> = {
  npc: {
    text: 'text-arcane',
    bg: 'bg-arcane/10',
    border: 'border-arcane/20',
    icon: '👤',
  },
  enemy: {
    text: 'text-ember',
    bg: 'bg-ember/10',
    border: 'border-ember/20',
    icon: '⚔',
  },
  item: {
    text: 'text-glow',
    bg: 'bg-glow/10',
    border: 'border-glow/20',
    icon: '✦',
  },
  location: {
    text: 'text-[#4ade80]',
    bg: 'bg-[#4ade80]/10',
    border: 'border-[#4ade80]/20',
    icon: '📍',
  },
  quest: {
    text: 'text-gold-light',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    icon: '★',
  },
  danger: {
    text: 'text-crimson',
    bg: 'bg-crimson/10',
    border: 'border-crimson/20',
    icon: '⚠',
  },
  lore: {
    text: 'text-parchment',
    bg: 'bg-parchment/10',
    border: 'border-parchment/20',
    icon: '📜',
  },
  skill: {
    text: 'text-gold',
    bg: 'bg-gold/8',
    border: 'border-gold/15',
    icon: '◆',
  },
  choice: {
    text: 'text-[#34d399]',
    bg: 'bg-[#34d399]/12',
    border: 'border-[#34d399]/25',
    icon: '❓',
  },
}

// Regex: matches  [tag:visible text]
const TAG_REGEX = /\[(\w+):([^\]]+)\]/g

function isTagCategory(tag: string): tag is TagCategory {
  return tag in TAG_STYLES
}

/* ── Tag extraction (for action input) ── */

export type NarrativeTag = {
  category: TagCategory
  label: string
  text: string
}

/** Extract all [tag:text] from narrative into a structured list. */
export function extractNarrativeTags(text: string): NarrativeTag[] {
  const tags: NarrativeTag[] = []
  const seen = new Set<string>()
  TAG_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG_REGEX.exec(text)) !== null) {
    const cat = match[1].toLowerCase()
    const content = match[2]
    const key = `${cat}:${content}`
    if (isTagCategory(cat) && !seen.has(key)) {
      seen.add(key)
      tags.push({ category: cat, label: TAG_LABELS[cat], text: content })
    }
  }
  return tags
}

/* ── Tooltip component ── */

function TagTooltip({ category, children }: { category: TagCategory; children: ReactNode }) {
  const [show, setShow] = useState(false)
  const [, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos({ x: rect.left + rect.width / 2, y: rect.top })
    }
  }, [show])

  const style = TAG_STYLES[category]
  const label = TAG_LABELS[category]

  return (
    <span
      ref={ref}
      className={`relative inline-flex cursor-default items-baseline gap-0.5 rounded-md border px-1 py-px font-semibold transition-all hover:brightness-125 ${style.text} ${style.bg} ${style.border}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-[9px] opacity-60" aria-hidden>{style.icon}</span>
      {children}
      {show && (
        <span
          className={`pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider shadow-lg ${style.text} ${style.bg} ${style.border}`}
        >
          {style.icon} {label}
        </span>
      )}
    </span>
  )
}

/** Parse a narrative string and return React nodes with colored tag spans + tooltips. */
export function parseNarrativeTags(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  TAG_REGEX.lastIndex = 0

  while ((match = TAG_REGEX.exec(text)) !== null) {
    const [fullMatch, rawTag, content] = match
    const tag = rawTag.toLowerCase()

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (isTagCategory(tag)) {
      nodes.push(
        <TagTooltip key={`${match.index}-${tag}`} category={tag}>
          {content}
        </TagTooltip>,
      )
    } else {
      nodes.push(fullMatch)
    }

    lastIndex = match.index + fullMatch.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

/* ── Component ── */

type NarrativeTextProps = {
  text: string
  className?: string
}

/**
 * Renders narrative text with tagged elements highlighted.
 * Splits by \n for paragraphs, then parses [tag:text] within each.
 */
export function NarrativeText({ text, className = '' }: NarrativeTextProps) {
  const paragraphs = text.split('\n')

  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <p
          key={i}
          className={`mt-2 text-sm leading-relaxed text-ink-muted first:mt-3 ${className}`}
        >
          {parseNarrativeTags(paragraph)}
        </p>
      ))}
    </>
  )
}
