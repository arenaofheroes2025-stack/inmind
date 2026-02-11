import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, ScrollText } from 'lucide-react'
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
      {/* ambient background effects — dark blue-gray atmosphere */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-[10%] h-[500px] w-[500px] rounded-full bg-gold/[0.03] blur-[160px]" />
        <div className="absolute -bottom-32 right-[5%] h-[400px] w-[400px] rounded-full bg-[#2a4a6b]/[0.08] blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-arcane/[0.02] blur-[120px]" />
        {/* subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
        }} />
      </div>

      {/* ══ top bar — ornate header ══ */}
      <header className="relative z-10 border-b border-gold/15 bg-panel/80 backdrop-blur-lg">
        {/* gold gradient line at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* logo icon with ornate border */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gold/30 bg-gradient-to-br from-gold/15 to-bronze/15 shadow-[0_0_16px_rgba(201,168,76,0.15)]">
              <Flame className="h-5 w-5 text-gold" />
              {/* inner frame line */}
              <div className="absolute inset-[2px] rounded-[5px] border border-gold/10" />
            </div>
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
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
