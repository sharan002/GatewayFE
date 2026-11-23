/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Minmini CRM Design Tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Central source of truth for all styling, colors, typography, elevations,
 * spacing, and dark/light theme consistency across the entire CRM.
 */

export const tokens = {
  colors: {
    // Surface & Backgrounds (Adaptive Light / Dark)
    bg: {
      app: 'bg-[#f7f8fa] dark:bg-[#0b0f19]',
      surface: 'bg-white dark:bg-[#111a28]',
      surfaceElevated: 'bg-white dark:bg-[#162235]',
      surfaceSubtle: 'bg-slate-50 dark:bg-[#1e2d42]',
      surfaceMuted: 'bg-slate-100/80 dark:bg-[#162233]',
      surfaceHover: 'hover:bg-slate-50 dark:hover:bg-[#1a2638]',
      surfaceActive: 'bg-blue-50/80 dark:bg-blue-950/40',
      surfaceHighlight: 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
      tableHeader: 'bg-[#1e293b] dark:bg-[#162235]',
      tableRowAlt: 'bg-slate-50/50 dark:bg-[#0e1624]/60',
    },

    // Borders
    border: {
      default: 'border-slate-200 dark:border-slate-800',
      subtle: 'border-slate-100 dark:border-slate-800/60',
      strong: 'border-slate-300 dark:border-slate-700',
      interactive: 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500',
      focus: 'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
    },

    // Typography Colors
    text: {
      primary: 'text-slate-900 dark:text-slate-100',
      secondary: 'text-slate-600 dark:text-slate-300',
      subtle: 'text-slate-500 dark:text-slate-400',
      muted: 'text-slate-400 dark:text-slate-500',
      brand: 'text-blue-600 dark:text-blue-400',
      purple: 'text-purple-600 dark:text-purple-400',
      inverse: 'text-white',
    },

    // Brand Palette
    brand: {
      primary: '#2563eb', // Blue 600
      primaryHover: '#1d4ed8', // Blue 700
      accent: '#8b5cf6', // Violet / Purple
      accentHover: '#7c3aed',
      emerald: '#10b981',
      rose: '#f43f5e',
      amber: '#f59e0b',
      sky: '#0284c7',
    },

    // Status / Pipeline Colors (Accessible Contrast for Both Themes)
    status: {
      hot: {
        badge: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60',
        dot: 'bg-rose-500',
        text: 'text-rose-600 dark:text-rose-400',
        solid: 'bg-rose-600 text-white',
      },
      warm: {
        badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60',
        dot: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        solid: 'bg-amber-500 text-white',
      },
      cold: {
        badge: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-900/60',
        dot: 'bg-sky-500',
        text: 'text-sky-600 dark:text-sky-400',
        solid: 'bg-sky-500 text-white',
      },
      enrolled: {
        badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60',
        dot: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
        solid: 'bg-emerald-600 text-white',
      },
      new: {
        badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60',
        dot: 'bg-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
        solid: 'bg-blue-600 text-white',
      },
      responded: {
        badge: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-900/60',
        dot: 'bg-purple-500',
        text: 'text-purple-600 dark:text-purple-400',
        solid: 'bg-purple-600 text-white',
      },
      neutral: {
        badge: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80',
        dot: 'bg-slate-400',
        text: 'text-slate-600 dark:text-slate-400',
        solid: 'bg-slate-600 text-white',
      },
    },

    // Standard Lead Source Channels Palette
    sources: {
      'Meta Ads': { hex: '#3985f4', bg: 'bg-[#3985f4]', text: 'text-blue-600 dark:text-blue-400' },
      'WhatsApp': { hex: '#25d366', bg: 'bg-[#25d366]', text: 'text-emerald-600 dark:text-emerald-400' },
      'Website': { hex: '#ff624f', bg: 'bg-[#ff624f]', text: 'text-rose-600 dark:text-rose-400' },
      'Call': { hex: '#48b7e7', bg: 'bg-[#48b7e7]', text: 'text-sky-600 dark:text-sky-400' },
      'Walk-in': { hex: '#53cdd1', bg: 'bg-[#53cdd1]', text: 'text-teal-600 dark:text-teal-400' },
      'Google Ads': { hex: '#ffb933', bg: 'bg-[#ffb933]', text: 'text-amber-600 dark:text-amber-400' },
      'Referral': { hex: '#aa72e5', bg: 'bg-[#aa72e5]', text: 'text-purple-600 dark:text-purple-400' },
      'Bulk Message': { hex: '#f05ad7', bg: 'bg-[#f05ad7]', text: 'text-fuchsia-600 dark:text-fuchsia-400' },
    } as Record<string, { hex: string; bg: string; text: string }>,
  },

  // Corner Radii
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    full: 'rounded-full',
  },

  // Shadows
  shadow: {
    xs: 'shadow-2xs',
    sm: 'shadow-xs',
    md: 'shadow-sm',
    lg: 'shadow-md',
    xl: 'shadow-lg',
    modal: 'shadow-2xl',
  },

  // Typography Presets
  typography: {
    h1: 'text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white',
    h2: 'text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white',
    h3: 'text-base sm:text-lg font-bold text-slate-900 dark:text-white',
    h4: 'text-sm font-semibold text-slate-900 dark:text-white',
    body: 'text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed',
    bodySm: 'text-xs text-slate-500 dark:text-slate-400 leading-normal',
    caption: 'text-[11px] text-slate-400 dark:text-slate-400',
    overline: 'text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400',
    number: 'tabular-nums font-bold tracking-tight',
  },

  // Transitions
  transition: {
    fast: 'transition-all duration-150 ease-in-out',
    normal: 'transition-all duration-200 ease-in-out',
    smooth: 'transition-all duration-300 ease-in-out',
  },
} as const;

export type ThemeTokens = typeof tokens;
