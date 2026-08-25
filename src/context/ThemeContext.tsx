import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeColors, lightTheme, darkTheme, spacing, radius, typography, motion, elevation } from '../constants/theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('extrovela_theme_mode');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light'; // Default to warm natural editorial light mode per Phase 2 spec
  });

  const colors = mode === 'light' ? lightTheme : darkTheme;

  useEffect(() => {
    localStorage.setItem('extrovela_theme_mode', mode);
    document.documentElement.setAttribute('data-theme', mode);

    // Inject CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--color-bg', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-surface-elevated', colors.surfaceElevated);
    root.style.setProperty('--color-surface-glass', colors.surfaceGlass);
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-hover', colors.primaryHover);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-accent-glow', colors.accentGlow);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-text-muted', colors.textMuted);
    root.style.setProperty('--color-text-inverse', colors.textInverse);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-border-hover', colors.borderHover);
    root.style.setProperty('--color-border-accent', colors.borderAccent);
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-error', colors.error);
  }, [mode, colors]);

  const toggleTheme = () => {
    setModeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
