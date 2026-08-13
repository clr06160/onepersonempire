'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ChartFundamentalsPanel from './ChartFundamentalsPanel';
import { analyzeElliottWave, formatElliottTarget } from '@/lib/charts/elliott-wave';
import type { ChartOverlayPoint, ScannerChartPayload } from '@/lib/charts/load-chart-data';

type StockChartPanelProps = {
  ticker: string;
  data: ScannerChartPayload | null;
  loading: boolean;
  error: string;
  onSelectTicker?: (ticker: string) => void;
};

const CHART_MIN_HEIGHT = 1040;
const CHART_HEIGHT_RATIO = 0.88;
/** Default window — ~4 months daily (~90 sessions); zoom/scroll for older history. */
const DEFAULT_VISIBLE_BARS = 90;

function chartHeight(): number {
  if (typeof window === 'undefined') return CHART_MIN_HEIGHT;
  return Math.max(CHART_MIN_HEIGHT, Math.round(window.innerHeight * CHART_HEIGHT_RATIO));
}

function applyDefaultVisibleRange(
  chart: ReturnType<typeof import('lightweight-charts').createChart>,
  barCount: number,
) {
  if (barCount <= 0) return;
  const visible = Math.min(DEFAULT_VISIBLE_BARS, barCount);
  chart.timeScale().setVisibleLogicalRange({
    from: barCount - visible - 1,
    to: barCount + 4,
  });
}

function lastOverlayValue(points: ChartOverlayPoint[]): number | null {
  if (!points.length) return null;
  return points[points.length - 1].value;
}

function formatPrice(value: number): string {
  return value >= 100 ? value.toFixed(2) : value.toFixed(4);
}

function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function LegendSwatch({
  color,
  label,
  value,
  dashed = false,
}: {
  color: string;
  label: string;
  value: number | null;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-800">
      <span
        className="inline-block w-5 shrink-0 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
        aria-hidden
      />
      <span className="font-semibold text-zinc-900">{label}</span>
      {value != null ? (
        <span className="font-mono font-semibold text-zinc-800">{formatPrice(value)}</span>
      ) : null}
    </span>
  );
}

export default function StockChartPanel({ ticker, data, loading, error, onSelectTicker }: StockChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const [panelHeight, setPanelHeight] = useState(CHART_MIN_HEIGHT);

  useEffect(() => {
    const updateHeight = () => setPanelHeight(chartHeight());
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const quote = useMemo(() => {
    if (!data?.bars.length) return null;
    const last = data.bars[data.bars.length - 1];
    const prev = data.bars.length > 1 ? data.bars[data.bars.length - 2] : null;
    const change = prev ? last.close - prev.close : 0;
    const changePct = prev && prev.close ? (change / prev.close) * 100 : 0;
    return {
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      change,
      changePct,
      sma50: lastOverlayValue(data.overlays.sma50),
      sma200: lastOverlayValue(data.overlays.sma200),
      ema10: lastOverlayValue(data.overlays.ema10),
      keltnerMid: lastOverlayValue(data.overlays.keltner?.middle ?? []),
    };
  }, [data]);

  const elliott = useMemo(() => {
    if (data?.elliottWave) {
      const embedded = data.elliottWave;
      return {
        label: embedded.label,
        phase: embedded.phase,
        direction: embedded.direction,
        targets: embedded.targets || [],
        waveHigh: embedded.waveHigh ?? undefined,
        waveLow: embedded.waveLow ?? undefined,
      };
    }
    if (!data?.bars.length) return null;
    return analyzeElliottWave(data.bars);
  }, [data]);

  useEffect(() => {
    if (!data || !containerRef.current || loading || error) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const mountChart = async () => {
      const { ColorType, createChart } = await import('lightweight-charts');
      if (disposed || !containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const container = containerRef.current;
      const initialHeight = chartHeight();

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: '#ffffff' },
          textColor: '#111827',
          fontSize: 16,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        },
        grid: {
          vertLines: { color: '#e5e7eb' },
          horzLines: { color: '#e5e7eb' },
        },
        rightPriceScale: {
          borderColor: '#d1d5db',
          scaleMargins: { top: 0.06, bottom: 0.16 },
        },
        timeScale: {
          borderColor: '#d1d5db',
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 13,
          minBarSpacing: 6,
          rightOffset: 8,
        },
        crosshair: {
          vertLine: { color: '#9ca3af', width: 1, style: 2 },
          horzLine: { color: '#9ca3af', width: 1, style: 2 },
        },
        width: container.clientWidth,
        height: initialHeight,
      });

      chartRef.current = chart;

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#ffffff',
        downColor: '#111827',
        borderUpColor: '#111827',
        borderDownColor: '#111827',
        wickUpColor: '#111827',
        wickDownColor: '#111827',
      });

      candlestickSeries.setData(
        data.bars.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })),
      );

      const volumeSeries = chart.addHistogramSeries({
        color: '#9ca3af',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.88, bottom: 0 },
      });

      volumeSeries.setData(
        data.bars.map((bar) => ({
          time: bar.time,
          value: bar.volume,
          color: bar.close >= bar.open ? 'rgba(22, 163, 74, 0.45)' : 'rgba(220, 38, 38, 0.45)',
        })),
      );

      const sma50Series = chart.addLineSeries({
        color: '#2563eb',
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma50Series.setData(
        data.overlays.sma50.map((point) => ({
          time: point.time,
          value: point.value,
        })),
      );

      const sma200Series = chart.addLineSeries({
        color: '#ea580c',
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma200Series.setData(
        data.overlays.sma200.map((point) => ({
          time: point.time,
          value: point.value,
        })),
      );

      const ema10Series = chart.addLineSeries({
        color: '#9333ea',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ema10Series.setData(
        data.overlays.ema10.map((point) => ({
          time: point.time,
          value: point.value,
        })),
      );

      const keltner = data.overlays.keltner;
      if (keltner?.middle.length) {
        const keltnerMiddle = chart.addLineSeries({
          color: '#0891b2',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        keltnerMiddle.setData(
          keltner.middle.map((point) => ({
            time: point.time,
            value: point.value,
          })),
        );

        const keltnerUpper = chart.addLineSeries({
          color: 'rgba(8, 145, 178, 0.55)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        keltnerUpper.setData(
          keltner.upper.map((point) => ({
            time: point.time,
            value: point.value,
          })),
        );

        const keltnerLower = chart.addLineSeries({
          color: 'rgba(8, 145, 178, 0.55)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        keltnerLower.setData(
          keltner.lower.map((point) => ({
            time: point.time,
            value: point.value,
          })),
        );
      }

      applyDefaultVisibleRange(chart, data.bars.length);

      const onResize = () => {
        if (!chartRef.current || !containerRef.current) return;
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: chartHeight(),
        });
      };

      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);
      window.addEventListener('resize', onResize);

      return onResize;
    };

    let resizeHandler: (() => void) | undefined;

    mountChart()
      .then((handler) => {
        resizeHandler = handler;
      })
      .catch(() => {
        // Parent shows error state if fetch fails; render errors stay local.
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, loading, error, ticker]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-zinc-300 bg-white"
        style={{ minHeight: panelHeight }}
      >
        <p className="text-base font-medium text-zinc-800">Loading {ticker} chart…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-red-300 bg-white px-6 text-center"
        style={{ minHeight: panelHeight }}
      >
        <p className="text-base text-red-600">{error}</p>
      </div>
    );
  }

  if (!data || !quote) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-zinc-300 bg-white"
        style={{ minHeight: panelHeight }}
      >
        <p className="text-base font-medium text-zinc-800">No chart data for {ticker}.</p>
      </div>
    );
  }

  const changePositive = quote.change >= 0;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-mono text-3xl font-bold tracking-tight text-zinc-900">{data.ticker}</h2>
            <p className="mt-1 text-sm font-medium text-zinc-800">
              Daily · ~{Math.min(DEFAULT_VISIBLE_BARS, data.bars.length)}-bar view ({data.bars.length} loaded) · as of{' '}
              {data.asOf}
              {data.fundamentals?.financialDate ? ` · FY filed ${data.fundamentals.financialDate}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-bold text-zinc-900">{formatPrice(quote.close)}</p>
            <p className={`mt-1 font-mono text-base font-semibold ${changePositive ? 'text-green-700' : 'text-red-600'}`}>
              {changePositive ? '+' : ''}
              {formatPrice(quote.change)} ({changePositive ? '+' : ''}
              {quote.changePct.toFixed(2)}%)
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Open</span>
            <p className="font-mono font-semibold text-zinc-900">{formatPrice(quote.open)}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">High</span>
            <p className="font-mono font-semibold text-zinc-900">{formatPrice(quote.high)}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Low</span>
            <p className="font-mono font-semibold text-zinc-900">{formatPrice(quote.low)}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Close</span>
            <p className="font-mono font-semibold text-zinc-900">{formatPrice(quote.close)}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Volume</span>
            <p className="font-mono font-semibold text-zinc-900">{formatVolume(quote.volume)}</p>
          </div>
        </div>

        {elliott ? (
          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/80 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-sm font-bold tracking-wide text-violet-900">{elliott.label}</span>
              <span className="text-sm text-violet-800">{elliott.phase}</span>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  elliott.direction === 'up'
                    ? 'text-green-700'
                    : elliott.direction === 'down'
                      ? 'text-red-600'
                      : 'text-zinc-700'
                }`}
              >
                {elliott.direction === 'up' ? '↑' : elliott.direction === 'down' ? '↓' : '—'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {elliott.waveHigh != null ? (
                <span className="text-zinc-700">
                  <span className="font-semibold text-zinc-800">Target high </span>
                  <span className="font-mono font-semibold text-green-800">${formatElliottTarget(elliott.waveHigh)}</span>
                </span>
              ) : null}
              {elliott.waveLow != null ? (
                <span className="text-zinc-700">
                  <span className="font-semibold text-zinc-800">Target low </span>
                  <span className="font-mono font-semibold text-red-700">${formatElliottTarget(elliott.waveLow)}</span>
                </span>
              ) : null}
              {elliott.targets
                .filter((target) => {
                  if (elliott.waveHigh != null && Math.abs(target.price - elliott.waveHigh) < 0.0001) return false;
                  if (elliott.waveLow != null && Math.abs(target.price - elliott.waveLow) < 0.0001) return false;
                  return true;
                })
                .map((target) => (
                  <span key={`${target.label}-${target.price}`} className="text-zinc-800">
                    <span className="font-semibold text-zinc-800">{target.label} </span>
                    <span
                      className={`font-mono font-semibold ${target.kind === 'high' ? 'text-green-800' : 'text-red-700'}`}
                    >
                      ${formatElliottTarget(target.price)}
                    </span>
                  </span>
                ))}
            </div>
            <p className="mt-2 text-xs text-violet-700/80">
              Rebuilt each trading day with the 7:35 AM scanner refresh (weekly count + daily Fib targets).
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 bg-white px-5 py-2.5 text-sm">
        <LegendSwatch color="#2563eb" label="SMA 50" value={quote.sma50} />
        <LegendSwatch color="#ea580c" label="SMA 200" value={quote.sma200} />
        <LegendSwatch color="#9333ea" label="EMA 10" value={quote.ema10} />
        {quote.keltnerMid != null ? (
          <LegendSwatch color="#0891b2" label="KC 20" value={quote.keltnerMid} dashed />
        ) : null}
      </div>

      <div ref={containerRef} className="w-full border-b border-zinc-200" style={{ height: panelHeight }} />

      {data.fundamentals ? (
        <ChartFundamentalsPanel fundamentals={data.fundamentals} onSelectTicker={onSelectTicker} />
      ) : null}
    </div>
  );
}
