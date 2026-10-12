import { useEffect, type RefObject } from 'react';
import Phaser from 'phaser';
import { buildTestMap } from '../data/testMap';
import { TestMapScene } from './TestMapScene';
import { onBackgroundChange } from '../../app/lifecycle';

export interface MapControls {
  zoomBy(factor: number): void;
  resetView(): void;
}

interface Props {
  host: RefObject<HTMLDivElement | null>;
  /** Receives the running Phaser game (or null on teardown) so HUD buttons can reach the map. */
  onGame?: (game: Phaser.Game | null) => void;
}

/** Mounts Phaser into the host element. The React HUD sits above it. */
export function GameCanvas({ host, onGame }: Props) {
  useEffect(() => {
    const parent = host.current;
    if (!parent) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#15130f',
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      input: { activePointers: 3 },
      render: { antialias: true, roundPixels: true },
      audio: { noAudio: true },
      fps: { target: 60, forceSetTimeOut: false },
      scene: [TestMapScene],
    });
    game.registry.set('tileGrid', buildTestMap());
    onGame?.(game);

    // Stop rendering and simulation while the app is in the background.
    const stopLifecycle = onBackgroundChange((inBackground) => {
      if (inBackground) game.loop.sleep();
      else game.loop.wake();
    });

    return () => {
      stopLifecycle();
      onGame?.(null);
      game.destroy(true);
    };
    // The game is created once per mount; host and onGame are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
