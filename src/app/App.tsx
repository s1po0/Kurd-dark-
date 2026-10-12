import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { MainMenu } from './screens/MainMenu';
import { HowToPlay } from './screens/HowToPlay';
import { GameScreen } from './screens/GameScreen';

const rootRoute = createRootRoute({
  component: () => (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  ),
});

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: MainMenu });
const howToRoute = createRoute({ getParentRoute: () => rootRoute, path: '/how-to', component: HowToPlay });
const gameRoute = createRoute({ getParentRoute: () => rootRoute, path: '/game', component: GameScreen });

const routeTree = rootRoute.addChildren([indexRoute, howToRoute, gameRoute]);

// Hash history keeps routing working from file-like WebView asset URLs.
const router = createRouter({ routeTree, history: createHashHistory(), defaultPreload: false });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
