// Every visible string lives here. Components call t('key').
export const en = {
  'menu.title': 'Emberhold',
  'menu.tagline': 'Raise the walls. Feed the people. Hold the keep.',
  'menu.testMap': 'Test map',
  'menu.howTo': 'How to play',
  'menu.howToBody':
    'Drag with one finger to pan. Pinch to zoom. The full game (economy, army, sieges) arrives in later milestones.',
  'menu.back': 'Back',
  'game.title': 'Test map',
  'game.hint': 'Drag to pan · pinch or scroll to zoom',
  'game.zoom': 'Zoom',
  'game.zoomIn': 'Zoom in',
  'game.zoomOut': 'Zoom out',
  'game.reset': 'Reset view',
  'game.backToMenu': 'Main menu',
  'error.title': 'Something went wrong',
  'error.body': 'The game hit an unexpected error. Your autosave is kept.',
  'error.restart': 'Restart',
  'common.loading': 'Loading…',
} as const;

export type TranslationKey = keyof typeof en;

export function t(key: TranslationKey): string {
  return en[key];
}
