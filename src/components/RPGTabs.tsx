import type { ReactNode } from 'react'

type RPGTabsProps = {
  tabs: { key: string; label: string; icon?: ReactNode }[]
  activeKey: string
  onSelect: (key: string) => void
  className?: string
}

export function RPGTabs({ tabs, activeKey, onSelect, className }: RPGTabsProps) {
  return (
    <div className={`flex items-center justify-center gap-1 ${className ?? ''}`}>
      {tabs.map((tab, i) => (
        <div key={tab.key} className="flex items-center">
          {i > 0 ? (
            <span className="mx-2 text-[8px] text-gold/30">◆</span>
          ) : null}
          <button
            type="button"
            onClick={() => onSelect(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
              activeKey === tab.key
                ? 'border border-gold/25 bg-gold/10 text-gold shadow-[0_0_12px_rgba(201,168,76,0.1)]'
                : 'border border-transparent text-ink-muted hover:text-ink hover:bg-panel-light/50'
            }`}
          >
            {tab.icon ? (
              <span className={`[&>svg]:h-3.5 [&>svg]:w-3.5 ${activeKey === tab.key ? 'text-gold' : ''}`}>
                {tab.icon}
              </span>
            ) : null}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        </div>
      ))}
    </div>
  )
}
