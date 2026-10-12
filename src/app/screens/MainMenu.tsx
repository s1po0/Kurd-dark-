import { Link } from '@tanstack/react-router';
import { BRAND } from '../../config/brand';
import { t } from '../../i18n/en';

// M0 menu: only entries that work. Continue, Campaign, Skirmish, Settings and
// Free Build appear in the milestone that builds them (no dead buttons).
export function MainMenu() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-8 bg-[radial-gradient(ellipse_at_center,_#3d2a18_0%,_#15130f_70%)] p-6">
      <div className="text-center">
        <h1 className="font-serif text-6xl font-bold tracking-wide text-brass drop-shadow-[0_3px_0_#5a3510]">
          {BRAND.name}
        </h1>
        <p className="mt-2 text-lg text-parchment/80">{t('menu.tagline')}</p>
      </div>
      <nav className="flex w-full max-w-xs flex-col gap-3">
        <Link
          to="/game"
          className="touch-btn flex items-center justify-center rounded-lg border border-brass/60 bg-brass px-6 py-3 text-lg font-semibold text-iron-900"
        >
          {t('menu.testMap')}
        </Link>
        <Link
          to="/how-to"
          className="touch-btn flex items-center justify-center rounded-lg border border-brass/40 bg-iron-700 px-6 py-3 text-lg text-parchment"
        >
          {t('menu.howTo')}
        </Link>
      </nav>
      <p className="text-sm text-parchment/50">v{BRAND.version}</p>
    </main>
  );
}
