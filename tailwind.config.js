/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── "Carbon & Plasma" dark theme ────────────────────────────────────
        // Matte carbon-fiber base lit by plasma-neon energy. Never pure black —
        // a blue-graphite void gives glows something to bleed into.
        bg: {
          void: '#0A0E14',     // app background (deepest)
          surface: '#121823',  // cards, sheets
          elevated: '#1A2230', // floating elements, modals
        },
        ink: {
          primary: '#F2F5FA',
          secondary: '#9AA6B8',
          muted: '#5A6679',
        },
        accent: {
          plasma: '#2DD4FF',      // primary brand cyan
          'plasma-deep': '#0E7FA8',
          violet: '#7C5CFF',      // secondary energy (exams / premium / flex)
        },
        // Node-state semantics: shape carries TYPE, colour carries STATE.
        // Stars escalate hue green → violet → gold for instant glanceability.
        state: {
          locked: '#2C3848',
          available: '#2DD4FF',
          pending: '#FFB020',
          star1: '#36C26E',
          star2: '#7C5CFF',
          star3: '#FFD23F',
          checkpoint: '#FF4D6D',
        },
        // Functional
        success: '#36C26E',
        warning: '#FFB020',
        danger: '#FF4D6D',
        info: '#2DD4FF',

        // ── Legacy tokens, re-skinned to the new palette so existing screens
        //    inherit "Carbon & Plasma" without per-component rewrites ─────────
        tunnel: {
          bg: '#0A0E14',
          panel: '#121823',
          line: '#222C3B',
        },
        skill: {
          locked: '#2C3848',
          available: '#2DD4FF',
          gold: '#FFD23F',
        },
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sheet: '28px',
        card: '20px',
      },
      keyframes: {
        // Glows use filter:drop-shadow (not box-shadow) so they follow the node's
        // clip-path outline — box-shadow would be clipped away on hexagon exams.
        breathe: {
          '0%,100%': { filter: 'drop-shadow(0 0 5px rgba(45,212,255,0.45))' },
          '50%':     { filter: 'drop-shadow(0 0 14px rgba(45,212,255,0.85))' },
        },
        shimmer: {
          '0%,100%': { filter: 'drop-shadow(0 0 5px rgba(255,176,32,0.40))' },
          '50%':     { filter: 'drop-shadow(0 0 14px rgba(255,176,32,0.80))' },
        },
        bloom: {
          '0%,100%': { filter: 'drop-shadow(0 0 8px rgba(255,210,63,0.55))' },
          '50%':     { filter: 'drop-shadow(0 0 18px rgba(255,210,63,0.90))' },
        },
        // Plasma energy flowing along an unlocked path
        flow: { to: { strokeDashoffset: '-16' } },
        // Fog-of-War reveal: a "?" silhouette materialises into a real node.
        // Runs on the node BUTTON (positioned via margins, so transform is free).
        materialize: {
          '0%':   { opacity: '0', transform: 'scale(0.5)', filter: 'blur(10px)' },
          '60%':  { filter: 'blur(0)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0)' },
        },
        // Celebration particle: flies out along per-particle CSS vars --tx/--ty.
        burst: {
          '0%':   { opacity: '1', transform: 'translate(0,0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(var(--tx), var(--ty)) scale(0.2)' },
        },
        // Celebration shockwave ring around an accepted node.
        flashRing: {
          '0%':   { opacity: '0.9', transform: 'scale(0.25)' },
          '100%': { opacity: '0', transform: 'scale(1.6)' },
        },
        pulseRing: {
          '0%':   { boxShadow: '0 0 0 0 rgba(45,212,255,0.55)' },
          '70%':  { boxShadow: '0 0 0 12px rgba(45,212,255,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(45,212,255,0)' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
        bloom: 'bloom 2.6s ease-in-out infinite',
        pulseRing: 'pulseRing 1.8s infinite',
        slideUp: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        materialize: 'materialize 0.7s cubic-bezier(0.16,1,0.3,1) both',
        burst: 'burst 0.9s cubic-bezier(0.2,0.7,0.3,1) forwards',
        flashRing: 'flashRing 0.7s ease-out forwards',
        // Gold mastery rays on 5★ exam nodes (transform-only — cheap)
        'spin-slow': 'spin 16s linear infinite',
      },
    },
  },
  plugins: [],
};
