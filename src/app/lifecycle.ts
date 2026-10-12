// Native lifecycle glue (Capacitor). Every call is safe in a plain browser:
// the Capacitor web fallbacks either no-op or are guarded here.
import { App } from '@capacitor/app';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export async function lockLandscape(): Promise<void> {
  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
  } catch {
    // Desktop browsers refuse orientation locks; the layout still works.
    const web = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
    await web.lock?.('landscape').catch(() => undefined);
  }
}

export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch {
    // Wake lock unsupported here; the game simply lets the screen sleep.
  }
}

/** Fires when the app goes to the background (true) or returns (false). */
export function onBackgroundChange(cb: (inBackground: boolean) => void): () => void {
  let handle: { remove: () => Promise<void> } | null = null;
  let disposed = false;
  void App.addListener('appStateChange', (state) => {
    cb(!state.isActive);
  }).then((h) => {
    if (disposed) void h.remove();
    else handle = h;
  });
  return () => {
    disposed = true;
    void handle?.remove();
  };
}

/** Android back button. Return true from the handler to consume the press. */
export function onBackButton(cb: () => boolean): () => void {
  let handle: { remove: () => Promise<void> } | null = null;
  let disposed = false;
  void App.addListener('backButton', () => {
    if (!cb()) {
      void App.minimizeApp().catch(() => undefined);
    }
  }).then((h) => {
    if (disposed) void h.remove();
    else handle = h;
  });
  return () => {
    disposed = true;
    void handle?.remove();
  };
}
