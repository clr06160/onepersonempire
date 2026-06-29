'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { IChartApi } from 'lightweight-charts';
import type { ChartBar, ScannerChartPayload } from '@/lib/charts/load-chart-data';

const POPUP_W = 400;
const CHART_H = 200;
const HEADER_H = 36;
const HOVER_DELAY_MS = 220;
const LEAVE_DELAY_MS = 150;
const PREVIEW_BARS = 180;

const chartCache = new Map<string, ScannerChartPayload>();
const scannerFetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function chartHref(ticker: string) {
  return `/scanner/charts?ticker=${encodeURIComponent(ticker.toUpperCase())}`;
}

function formatPrice(value: number) {
  return value >= 100 ? value.toFixed(2) : value.toFixed(4);
}

function sliceBars(bars: ChartBar[]) {
  return bars.length <= PREVIEW_BARS ? bars : bars.slice(-PREVIEW_BARS);
}

async function fetchChartPayload(symbol: string): Promise<ScannerChartPayload> {
  const cached = chartCache.get(symbol);
  if (cached) return cached;

  const response = await fetch(`/api/scanner/charts/${encodeURIComponent(symbol)}`, scannerFetchInit);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Chart unavailable');
  }
  chartCache.set(symbol, payload.data);
  return payload.data;
}

function MiniChart({ bars }: { bars: ChartBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !bars.length) return;

    let disposed = false;
    let chart: IChartApi | null = null;

    const mount = async () => {
      const { ColorType, createChart } = await import('lightweight-charts');
      if (disposed || !containerRef.current) return;

      chart = createChart(containerRef.current, {
        width: POPUP_W,
        height: CHART_H,
        layout: {
          background: { type: ColorType.Solid, color: '#ffffff' },
          textColor: '#374151',
          fontSize: 10,
        },
        grid: {
          vertLines: { color: '#f3f4f6' },
          horzLines: { color: '#f3f4f6' },
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.08, bottom: 0.2 },
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 4,
          minBarSpacing: 2,
          rightOffset: 2,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        crosshair: { mode: 0 },
        handleScroll: false,
        handleScale: false,
      });

      const line = chart.addLineSeries({
        color: '#111827',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      line.setData(
        bars.map((bar) => ({
          time: bar.time,
          value: bar.close,
        })),
      );

      const volume = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volume.setData(
        bars.map((bar) => ({
          time: bar.time,
          value: bar.volume,
          color: bar.close >= bar.open ? 'rgba(248, 113, 113, 0.55)' : 'rgba(209, 213, 219, 0.8)',
        })),
      );

      chart.timeScale().fitContent();
    };

    void mount();
    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [bars]);

  return <div ref={containerRef} className="w-full bg-white" style={{ height: CHART_H }} />;
}

function ChartHoverPopup({
  ticker,
  data,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  ticker: string;
  data: ScannerChartPayload;
  style: CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const bars = sliceBars(data.bars);
  const last = bars[bars.length - 1];
  const prev = bars.length > 1 ? bars[bars.length - 2] : null;
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = prev && prev.close ? (change / prev.close) * 100 : 0;
  const up = change >= 0;

  return (
    <div
      className="fixed z-[300] overflow-hidden rounded border border-zinc-300 bg-white shadow-2xl"
      style={{ ...style, width: POPUP_W }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="flex items-center justify-between border-b border-zinc-200 bg-white px-2.5 text-[11px] text-zinc-700"
        style={{ height: HEADER_H }}
      >
        <span className="font-bold text-zinc-900">{ticker}</span>
        {last ? (
          <span className="font-mono">
            <span className="text-zinc-900">{formatPrice(last.close)}</span>{' '}
            <span className={up ? 'text-emerald-600' : 'text-red-600'}>
              {change >= 0 ? '+' : ''}
              {formatPrice(change)} ({changePct >= 0 ? '+' : ''}
              {changePct.toFixed(1)}%)
            </span>
          </span>
        ) : null}
      </div>
      <MiniChart bars={bars} />
    </div>
  );
}

export default function TickerLink({
  ticker,
  ewLabel,
  className = '',
}: {
  ticker: string;
  ewLabel?: string;
  className?: string;
}) {
  const symbol = ticker.toUpperCase();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const hoveringRef = useRef(false);
  const hoverTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const [preview, setPreview] = useState<ScannerChartPayload | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const clearTimers = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const placePopup = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const gap = 10;
    const popupH = HEADER_H + CHART_H;

    // Center horizontally on the ticker, clamped to the viewport.
    let left = rect.left + rect.width / 2 - POPUP_W / 2;
    if (left + POPUP_W > window.innerWidth - margin) {
      left = window.innerWidth - POPUP_W - margin;
    }
    if (left < margin) left = margin;

    // Prefer placing the preview ABOVE the row so it stays clear of the names
    // below while scanning the list top-to-bottom. Fall back to below only when
    // there isn't enough room above.
    let top = rect.top - popupH - gap;
    if (top < margin) {
      top = rect.bottom + gap;
      if (top + popupH > window.innerHeight - margin) {
        top = window.innerHeight - popupH - margin;
      }
      if (top < margin) top = margin;
    }

    setPosition({ top, left });
  }, []);

  const hidePreview = useCallback(() => {
    clearTimers();
    leaveTimer.current = window.setTimeout(() => {
      if (!hoveringRef.current) {
        setPreview(null);
        setPosition(null);
      }
    }, LEAVE_DELAY_MS);
  }, [clearTimers]);

  const onEnter = useCallback(() => {
    hoveringRef.current = true;
    clearTimers();
    hoverTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await fetchChartPayload(symbol);
          if (!hoveringRef.current) return;
          placePopup();
          setPreview(data);
        } catch {
          if (hoveringRef.current) {
            setPreview(null);
            setPosition(null);
          }
        }
      })();
    }, HOVER_DELAY_MS);
  }, [clearTimers, placePopup, symbol]);

  const onLeave = useCallback(() => {
    hoveringRef.current = false;
    hidePreview();
  }, [hidePreview]);

  useEffect(() => {
    if (!preview) return;
    const reposition = () => placePopup();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [placePopup, preview]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const popup =
    preview && position && typeof document !== 'undefined'
      ? createPortal(
          <ChartHoverPopup
            ticker={symbol}
            data={preview}
            style={{ top: position.top, left: position.left }}
            onMouseEnter={() => {
              hoveringRef.current = true;
              clearTimers();
            }}
            onMouseLeave={onLeave}
          />,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex items-center"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <Link
          href={chartHref(symbol)}
          className={`flex items-center font-semibold text-emerald-300 hover:text-emerald-200 hover:underline ${className}`}
        >
          {ticker}
          {ewLabel ? (
            <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-normal lowercase text-zinc-500">{ewLabel}</span>
          ) : null}
        </Link>
      </span>
      {popup}
    </>
  );
}
