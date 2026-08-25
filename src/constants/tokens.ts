/**
 * EXTROVELA — Design System Tokens
 * 
 * Strict visual design tokens for dark, cinematic, adventurous aesthetics.
 * Matches Instagram-level contrast with lime brand accents and tactile touch targets.
 */

export const tokens = {
  colors: {
    bg: {
      primary: '#08090D',
      surface: '#0F1117',
      elevated: '#171922',
      glass: 'rgba(255, 255, 255, 0.04)',
      glassHover: 'rgba(255, 255, 255, 0.07)',
      overlay: 'rgba(0, 0, 0, 0.82)',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      muted: '#64748B',
      brand: '#84CC16',
    },
    accent: {
      lime: '#84CC16',
      limeGlow: 'rgba(132, 204, 22, 0.28)',
      sunset: '#F97316',
      gold: '#F59E0B',
      cyan: '#06B6D4',
      violet: '#8B5CF6',
      pink: '#EC4899',
      emerald: '#10B981',
      rose: '#F43F5E',
    },
    border: {
      glass: 'rgba(255, 255, 255, 0.08)',
      glassHover: 'rgba(255, 255, 255, 0.16)',
      brand: 'rgba(132, 204, 22, 0.4)',
    },
  },

  typography: {
    fontFamily: {
      sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    size: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
  },

  spacing: {
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '5': '20px',
    '6': '24px',
    '8': '32px',
    '10': '40px',
    '12': '48px',
    '16': '64px',
  },

  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    full: '9999px',
  },

  shadows: {
    card: '0 8px 32px rgba(0, 0, 0, 0.45)',
    glowLime: '0 0 24px rgba(132, 204, 22, 0.3)',
    glowSunset: '0 0 24px rgba(249, 115, 22, 0.3)',
    modal: '0 24px 64px rgba(0, 0, 0, 0.75)',
  },

  touchTarget: {
    minHeight: '44px',
    minWidth: '44px',
  },
} as const;

export default tokens;
