/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        obsidian: 'var(--obsidian)',
        panel: 'var(--panel)',
        'panel-light': 'var(--panel-light)',
        surface: 'var(--surface)',
        ember: 'var(--ember)',
        glow: 'var(--glow)',
        gold: 'var(--gold)',
        'gold-light': 'var(--gold-light)',
        'gold-dim': 'var(--gold-dim)',
        bronze: 'var(--bronze)',
        crimson: 'var(--crimson)',
        arcane: 'var(--arcane)',
        parchment: 'var(--parchment)',
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', '"Times New Roman"', 'serif'],
        'display-decorative': ['"Cinzel Decorative"', '"Cinzel"', 'Georgia', 'serif'],
        body: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'frame': '12px',
      },
    },
  },
  plugins: [],
}
