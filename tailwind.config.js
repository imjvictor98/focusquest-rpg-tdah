/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0B0F19',
        surface: '#131A2A',
        surfaceHover: '#1A2337',
        borderSubtle: '#1E293B',
        tunnelBg: '#09090b',
      },
      keyframes: {
        floatUp: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(0.95)' },
          '20%': { opacity: '1', transform: 'translateY(-12px) scale(1.08)' },
          '100%': { opacity: '0', transform: 'translateY(-48px) scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(245, 158, 11, 0.35), inset 0 0 10px rgba(245, 158, 11, 0.15)' },
          '50%': { boxShadow: '0 0 28px rgba(245, 158, 11, 0.7), inset 0 0 16px rgba(245, 158, 11, 0.25)' },
        },
        bossHit: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px) rotate(-0.5deg)' },
          '40%': { transform: 'translateX(6px) rotate(0.5deg)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        }
      },
      animation: {
        'float-up': 'floatUp 1.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-glow': 'pulseGlow 2s infinite ease-in-out',
        'boss-hit': 'bossHit 0.35s ease-in-out',
      }
    },
  },
  plugins: [],
}
