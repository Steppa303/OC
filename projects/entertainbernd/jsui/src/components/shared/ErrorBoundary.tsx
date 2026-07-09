import React from 'react';

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <div className="text-3xl mb-3">💥</div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--tg-text-color)' }}>Da ist was schiefgelaufen</p>
          <p className="text-xs" style={{ color: 'var(--tg-hint-color)' }}>
            {this.state.error?.message || 'Unbekannter Fehler'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--tg-button-color)', color: 'var(--tg-button-text-color)' }}
          >
            Neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}