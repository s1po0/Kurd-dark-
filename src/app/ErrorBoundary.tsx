import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n/en';

interface State {
  failed: boolean;
}

// Catches render errors anywhere below it and shows a friendly screen with a
// Restart button. The autosave (written by the save service) is not touched.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Emberhold render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-serif text-2xl text-brass">{t('error.title')}</h1>
        <p className="max-w-md text-parchment/80">{t('error.body')}</p>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="touch-btn rounded-lg bg-brass px-6 py-3 font-semibold text-iron-900"
        >
          {t('error.restart')}
        </button>
      </div>
    );
  }
}
