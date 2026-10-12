import { useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import type Phaser from 'phaser';
import { t } from '../../i18n/en';
import { GameCanvas, type MapControls } from '../../game/render/GameCanvas';
import { keepAwake, lockLandscape, onBackButton } from '../lifecycle';

export function GameScreen() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    void lockLandscape();
    void keepAwake(true);
    return () => void keepAwake(false);
  }, []);

  // Android back returns to the menu for now; it opens the pause menu in M3.
  useEffect(
    () =>
      onBackButton(() => {
        window.history.back();
        return true;
      }),
    [],
  );

  const controls = (): MapControls | undefined =>
    game.current?.registry.get('mapControls') as MapControls | undefined;

  return (
    <main className="relative h-full w-full">
      <div ref={canvasHost} className="absolute inset-0" />
      <GameCanvas host={canvasHost} onGame={(g) => (game.current = g)} />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <Link
          to="/"
          className="pointer-events-auto touch-btn rounded-lg border border-brass/50 bg-iron-800/90 px-4 py-2 text-sm text-parchment"
        >
          {t('game.backToMenu')}
        </Link>
        <p className="rounded-lg bg-iron-800/80 px-3 py-2 text-sm text-parchment/85">{t('game.hint')}</p>
      </header>

      <aside
        aria-label={t('game.zoom')}
        className="pointer-events-auto absolute bottom-3 end-3 flex flex-col gap-2"
      >
        <button
          type="button"
          aria-label={t('game.zoomIn')}
          onClick={() => controls()?.zoomBy(1.25)}
          className="touch-btn rounded-lg border border-brass/50 bg-iron-800/90 px-4 text-xl text-parchment"
        >
          +
        </button>
        <button
          type="button"
          aria-label={t('game.zoomOut')}
          onClick={() => controls()?.zoomBy(0.8)}
          className="touch-btn rounded-lg border border-brass/50 bg-iron-800/90 px-4 text-xl text-parchment"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => controls()?.resetView()}
          className="touch-btn rounded-lg border border-brass/50 bg-iron-800/90 px-3 text-sm text-parchment"
        >
          {t('game.reset')}
        </button>
      </aside>
    </main>
  );
}
