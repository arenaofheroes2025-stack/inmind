import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ScrollText } from 'lucide-react'
import { BlueprintScreen } from '../screens/BlueprintScreen'
import { AdventureScreen } from '../screens/AdventureScreen'
import { CharacterCreateScreen } from '../screens/CharacterCreateScreen'
import { CharacterHubScreen } from '../screens/CharacterHubScreen'
import { MainMenuScreen } from '../screens/MainMenuScreen'
import { TitleScreen } from '../screens/TitleScreen'
import { SyncWorldId, SyncEditingCharId, SyncNewCharacter } from './RouteSync'

export default function App() {
  const location = useLocation()

  return (
    <div className="relative min-h-dvh overflow-clip bg-obsidian">
      {/* simplified background — removed heavy gradients for iOS performance */}
      <div className="pointer-events-none fixed inset-0">
        {/* single subtle glow instead of multiple */}
        <div className="absolute inset-0 bg-gradient-to-br from-obsidian via-[#0a1420] to-obsidian" />
      </div>

      {/* ══ top bar — ornate header ══ */}
      <header className="relative z-10 border-b border-gold/15 bg-panel/80 backdrop-blur-lg">
        {/* gold gradient line at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-display-decorative text-sm font-bold tracking-wider text-gold">
                InMind
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-gold-dim">
                RPG Engine
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-ink-muted">
            <ScrollText className="h-4 w-4 text-gold-dim" />
            <span className="hidden text-[10px] uppercase tracking-[0.3em] text-gold-dim sm:inline">
              Narrativa Procedural
            </span>
          </div>
        </div>
      </header>

      {/* ══ main content ══ */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <Routes location={location}>
              {/* Menu principal */}
              <Route path="/" element={<MainMenuScreen />} />

              {/* Criar nova aventura (wizard de mundo) */}
              <Route path="/nova-aventura" element={<TitleScreen />} />

              {/* Hub de personagens de um mundo */}
              <Route path="/aventura/:worldId" element={<><SyncWorldId /><CharacterHubScreen /></>} />

              {/* Criar novo personagem */}
              <Route path="/aventura/:worldId/personagem/novo" element={<><SyncWorldId /><SyncNewCharacter /><CharacterCreateScreen /></>} />
                                                                                  
              {/* Editar personagem existente */}
              <Route path="/aventura/:worldId/personagem/:charId" element={<><SyncWorldId /><SyncEditingCharId /><CharacterCreateScreen /></>} />

              {/* Mapa / Blueprint do mundo */}
              <Route path="/aventura/:worldId/mapa" element={<><SyncWorldId /><BlueprintScreen /></>} />

              {/* Tela de jogo / aventura */}
              <Route path="/aventura/:worldId/jogar" element={<><SyncWorldId /><AdventureScreen /></>} />

              {/* Fallback → menu */}
              <Route path="*" element={<MainMenuScreen />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
