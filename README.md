# Inmind RPG

Sistema de RPG narrativo procedural com IA em modo offline/cache-first.
A IA gera conteudo, o jogo salva localmente, e a jogabilidade consome do cache.

## Objetivo

- Gerar uma aventura completa com inicio, meio e fim
- Permitir escolhas, rolagens de dado e combate
- Garantir jogabilidade offline apos a geracao inicial

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Zustand (estado)
- IndexedDB via `idb` (cache)
- Framer Motion (animacoes)
- PWA com service worker

## Scripts

- `npm run dev` - ambiente de desenvolvimento
- `npm run build` - build de producao
- `npm run preview` - preview local do build

## Estrutura base

src/
  app/
  components/
  screens/
  systems/
  store/
  services/
  data/
  assets/
  utils/

## Idioma

Todo o jogo deve estar em portugues brasileiro.
