'use client';

import { memo, useEffect, useRef } from 'react';

type TradingViewWidgetPanelProps = {
  ticker: string;
};

/**
 * Embeds TradingView's free advanced-chart widget. TradingView serves its own
 * licensed market data directly to the user's browser — this site never sources,
 * caches, or redistributes price data here. Attribution is required by the
 * TradingView widget terms and is rendered below the chart.
 */
function TradingViewWidgetPanel({ ticker }: TradingViewWidgetPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !ticker) return;

    container.innerHTML = '';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = 'calc(100% - 28px)';
    widget.style.width = '100%';
    container.appendChild(widget);

    const copyright = document.createElement('div');
    copyright.className = 'tradingview-widget-copyright';
    copyright.style.fontSize = '12px';
    copyright.style.lineHeight = '28px';
    copyright.style.textAlign = 'right';
    copyright.style.paddingRight = '8px';
    copyright.innerHTML =
      '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style="color:#047857;font-weight:600;text-decoration:none;">Chart by TradingView</a>';
    container.appendChild(copyright);

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker.toUpperCase(),
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      withdateranges: true,
      hide_side_toolbar: false,
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [ticker]);

  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-2 shadow-sm">
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height: '85vh', minHeight: 700, width: '100%' }}
      />
      <p className="px-1 pt-1 text-xs text-zinc-600">
        Live charts provided by TradingView. Sign in to TradingView for real-time data and your own layouts.
      </p>
    </div>
  );
}

export default memo(TradingViewWidgetPanel);
