import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0a] text-gray-100 p-6">
          <div className="max-w-md w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/50">
            <h1 className="text-lg font-semibold text-red-300 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-400 mb-4">
              The app hit an unexpected error. You can try again or reload the page.
            </p>
            {this.state.error?.message && (
              <pre className="text-[11px] text-gray-500 bg-black/40 border border-white/5 rounded-lg p-3 mb-4 overflow-x-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-gray-100 text-sm font-medium transition-colors"
                type="button"
              >
                Try again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-medium transition-colors"
                type="button"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
