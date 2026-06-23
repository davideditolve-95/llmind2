const tintColorLight = '#0d9488'; // Teal primary
const tintColorDark = '#14b8a6';  // Teal primary per dark

export default {
  light: {
    text: '#0f172a', // Slate-900
    background: '#f8fafc', // Slate-50 body background
    card: '#ffffff', // Card background
    primary: '#0d9488', // Teal-600
    primaryLight: '#ccfbf1', // Teal-100
    accent: '#4f46e5', // Indigo-600
    accentLight: '#e0e7ff', // Indigo-100
    border: '#e2e8f0', // Slate-200
    tint: tintColorLight,
    tabIconDefault: '#94a3b8', // Slate-400
    tabIconSelected: tintColorLight,
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
  },
  dark: {
    text: '#f1f5f9', // Slate-100
    background: '#0f172a', // Slate-900 body background
    card: '#1e293b', // Slate-800 Card
    primary: '#14b8a6', // Teal-500
    primaryLight: '#115e59', // Teal-800
    accent: '#6366f1', // Indigo-500
    accentLight: '#3730a3', // Indigo-800
    border: '#334155', // Slate-700
    tint: tintColorDark,
    tabIconDefault: '#475569', // Slate-600
    tabIconSelected: tintColorDark,
    success: '#34d399',
    danger: '#f87171',
    warning: '#fbbf24',
  },
};
