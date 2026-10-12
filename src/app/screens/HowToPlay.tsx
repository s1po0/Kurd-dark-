import { Link } from '@tanstack/react-router';
import { t } from '../../i18n/en';

export function HowToPlay() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="font-serif text-3xl text-brass">{t('menu.howTo')}</h1>
      <p className="max-w-md text-lg text-parchment/85">{t('menu.howToBody')}</p>
      <Link
        to="/"
        className="touch-btn flex items-center justify-center rounded-lg border border-brass/60 bg-iron-700 px-8 py-3 text-lg text-parchment"
      >
        {t('menu.back')}
      </Link>
    </main>
  );
}
