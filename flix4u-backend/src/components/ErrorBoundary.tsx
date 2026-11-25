import React from 'react';
import { AlertTriangle, Home, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
  onResetHome?: () => void;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[Flix4U ErrorBoundary]', error, info?.componentStack);
    this.setState({
      componentStack: info?.componentStack ? info.componentStack.trim().slice(0, 1200) : null,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
        componentStack: null,
        showDetails: false,
      });
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
      showDetails: false,
    });
  };

  private handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
      showDetails: false,
    });
    if (this.props.onResetHome) {
      this.props.onResetHome();
    } else if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message =
      this.state.error?.message?.trim() || 'An unexpected rendering error occurred.';

    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-4 py-10">
        <div className="kuro-glass-elevated w-full rounded-3xl border border-rose-500/30 p-6 sm:p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/35 bg-rose-500/15 text-rose-300">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h2 className="mt-4 text-xl font-bold text-white">
            {this.props.fallbackTitle || 'Something went wrong loading this view'}
          </h2>
          <p className="mt-2 break-words text-sm text-rose-200">{message}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={this.handleRetry}
              className="kuro-btn-primary inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4.5 py-2 text-xs sm:text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="kuro-btn-glass inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4.5 py-2 text-xs sm:text-sm font-semibold"
            >
              <Home className="h-4 w-4" />
              <span>Go Home</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="kuro-btn-glass inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4.5 py-2 text-xs sm:text-sm font-semibold"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload</span>
            </button>
          </div>

          {(this.state.error?.stack || this.state.componentStack) && (
            <div className="mt-5 text-left">
              <button
                type="button"
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                className="text-xs font-medium text-slate-400 underline underline-offset-4 hover:text-slate-200"
              >
                {this.state.showDetails ? 'Hide diagnostic details' : 'Show diagnostic details'}
              </button>
              {this.state.showDetails && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/[0.08] bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
                  {[this.state.error?.stack, this.state.componentStack].filter(Boolean).join('\n\n')}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
