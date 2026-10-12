import type { CapacitorConfig } from '@capacitor/cli';
import { BRAND } from './src/config/brand';

// No `server` block: the APK loads the built bundle from dist/ and never
// talks to a dev server or the network.
const config: CapacitorConfig = {
  appId: BRAND.appId,
  appName: BRAND.name,
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
