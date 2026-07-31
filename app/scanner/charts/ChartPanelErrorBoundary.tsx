'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  ticker: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/** Catches render errors inside the chart panel without taking down the search UI. */
export default class ChartPanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[scanner/charts/panel]', this.props.ticker, error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.ticker !== this.props.ticker && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">Could not render chart for {this.props.ticker}</p>
          <p className="mt-2 text-sm text-red-700">Chart data could not be loaded. Try again or pick another ticker.</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-full border border-red-400 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:border-red-600"
          >
            Retry chart
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
