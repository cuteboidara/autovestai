import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        page: 'var(--bg-page)',
        surface: 'var(--bg-surface)',
        panel: 'var(--bg-surface)',
        sidebar: 'var(--bg-sidebar)',
        sidebarHover: 'var(--bg-sidebar-hover)',
        sidebarActive: 'var(--bg-sidebar-active)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        inverse: 'var(--text-inverse)',
        accent: 'var(--accent)',
        accentHover: 'var(--accent-hover)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        border: 'var(--border)',
        borderStrong: 'var(--border-strong)',
      },
      boxShadow: {
        glow: 'var(--shadow-card)',
        shell: 'var(--shadow-shell)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'sans-serif'],
        mono: ['"SFMono-Regular"', '"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
