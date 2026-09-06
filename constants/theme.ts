export const Colors = {
  // Main background: deep dark navy
  background: '#042236',
  backgroundDarker: '#031928',
  
  // App Bar: solid classic Android cyan-blue
  primary: '#0078B7',
  primaryDark: '#006296',
  primaryLight: '#0288D1',

  // Cards
  cardBackground: '#073656',
  cardBackgroundPressed: '#0A436B',
  cardBorder: '#0C4B78',
  cardCompleted: '#052942',

  // Accents & Headings
  accentCyan: '#4FC3F7',
  accentBlue: '#29B6F6',
  accentOverdue: '#FF6E6E',
  accentOverdueText: '#FF8A80',
  accentUpcoming: '#81D4FA',
  accentCompleted: '#546E7A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8FB4CB',
  textMuted: '#5C849E',
  textDisabled: '#455A64',
  textOverdue: '#FF8A80',

  // Controls & Inputs
  inputUnderline: '#0088CC',
  inputBackground: 'transparent',
  placeholder: '#5A829D',
  checkboxBorder: '#789EB7',
  checkboxChecked: '#4FC3F7',

  // FAB
  fabBackground: '#FFFFFF',
  fabIcon: '#0078B7',
  fabShadow: '#000000',

  // Dialogs & Modals
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  modalBackground: '#062B45',
  modalBorder: '#0E4973',
  divider: '#0A3B5C',
};

export const Typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 26,
    title: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
};
