/**
 * EXTROVELA — Editorial & Cinematic Theme System
 * 
 * Natural Forest & Warm Olive Palette matching the Phase 2 Design Specification.
 * Supports both Warm Editorial Light Mode and Dark Forest Nocturne Mode.
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  accentGlow: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderHover: string;
  borderAccent: string;
  success: string;
  warning: string;
  error: string;
}

export const lightTheme: ThemeColors = {
  background: '#F6F1E7',
  surface: '#EFEAE0',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.65)',
  primary: '#1D2A20',       // Deep Forest
  primaryHover: '#28351D',  // Forest
  secondary: '#56643A',     // Warm Olive
  accent: '#C99A45',        // Accent Gold
  accentGlow: 'rgba(201, 154, 69, 0.25)',
  text: '#181818',
  textSecondary: '#6B6A62',
  textMuted: '#A6A399',
  textInverse: '#F6F1E7',
  border: 'rgba(29, 42, 32, 0.12)',
  borderHover: 'rgba(29, 42, 32, 0.24)',
  borderAccent: 'rgba(201, 154, 69, 0.4)',
  success: '#4A7C59',       // Muted natural green
  warning: '#D97706',       // Warm amber
  error: '#B91C1C',         // Restrained red
};

export const darkTheme: ThemeColors = {
  background: '#171813',     // Dark Background
  surface: '#22231D',        // Dark Surface
  surfaceElevated: '#2C2D25',
  surfaceGlass: 'rgba(34, 35, 29, 0.75)',
  primary: '#84CC16',        // Brand Lime / Golden Glow
  primaryHover: '#A3E635',
  secondary: '#65744A',      // Olive
  accent: '#C99A45',         // Accent Gold
  accentGlow: 'rgba(201, 154, 69, 0.3)',
  text: '#F6F1E7',
  textSecondary: '#A6A399',
  textMuted: '#6B6A62',
  textInverse: '#171813',
  border: 'rgba(246, 241, 231, 0.10)',
  borderHover: 'rgba(246, 241, 231, 0.20)',
  borderAccent: 'rgba(201, 154, 69, 0.45)',
  success: '#4A7C59',
  warning: '#D97706',
  error: '#EF4444',
};

export const spacing = {
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
  '20': '80px',
} as const;

export const radius = {
  small: '8px',
  medium: '12px',
  large: '16px',
  XL: '24px',
  pill: '9999px',
} as const;

export const typography = {
  fontFamily: {
    display: "'Outfit', 'Playfair Display', -apple-system, sans-serif",
    sans: "'Plus Jakarta Sans', -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  scale: {
    display: { fontSize: '2.5rem', lineHeight: '1.15', fontWeight: 900, letterSpacing: '-0.02em' },
    headingXL: { fontSize: '2rem', lineHeight: '1.2', fontWeight: 800, letterSpacing: '-0.015em' },
    headingLG: { fontSize: '1.5rem', lineHeight: '1.25', fontWeight: 800, letterSpacing: '-0.01em' },
    headingMD: { fontSize: '1.25rem', lineHeight: '1.3', fontWeight: 700 },
    bodyLG: { fontSize: '1.125rem', lineHeight: '1.55', fontWeight: 400 },
    bodyMD: { fontSize: '1rem', lineHeight: '1.6', fontWeight: 400 },
    bodySM: { fontSize: '0.875rem', lineHeight: '1.5', fontWeight: 400 },
    caption: { fontSize: '0.75rem', lineHeight: '1.4', fontWeight: 500, letterSpacing: '0.02em' },
    label: { fontSize: '0.75rem', lineHeight: '1.2', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
    button: { fontSize: '0.875rem', lineHeight: '1', fontWeight: 700, letterSpacing: '0.02em' },
  },
} as const;

export const motion = {
  micro: '120ms cubic-bezier(0.16, 1, 0.3, 1)',
  fast: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
  normal: '350ms cubic-bezier(0.16, 1, 0.3, 1)',
  slow: '500ms cubic-bezier(0.16, 1, 0.3, 1)',
  cinematic: '700ms cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const elevation = {
  card: '0 8px 24px rgba(0, 0, 0, 0.08)',
  elevated: '0 16px 40px rgba(0, 0, 0, 0.12)',
  glowGold: '0 0 28px rgba(201, 154, 69, 0.35)',
  glowForest: '0 0 28px rgba(40, 53, 29, 0.35)',
  modal: '0 24px 64px rgba(0, 0, 0, 0.35)',
} as const;
