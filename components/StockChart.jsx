"use client";

import { useEffect, useRef } from "react";

/**
 * TradingView-style candlestick chart — lightweight-charts v5.
 *
 * v5 API change: series added via chart.addSeries(SeriesPlugin, opts)
 * instead of chart.addCandlestickSeries(opts) etc.
 */
export default function StockChart({
  ohlcv,
  sma20Line = [],
  sma50Line = [],
  high6mo,
  low6mo,
  latestClose,
  ticker,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ohlcv || ohlcv.length === 0 || !containerRef.current) return;

    const style = getComputedStyle(document.documentElement);
    const cssVar = (name, fallback) => style.getPropertyValue(name).trim() || fallback;

    const COLOR_BG     = cssVar("--bg",       "#0b0d12");
    const COLOR_BORDER = cssVar("--border",   "#262b38");
    const COLOR_TEXT   = cssVar("--text",     "#e8eaf0");
    const COLOR_DIM    = cssVar("--text-dim", "#9aa1b2");
    const COLOR_ACCENT = cssVar("--accent",   "#5b8cff");
    const COLOR_GREEN  = cssVar("--green",    "#3ecf8e");
    const COLOR_RED    = cssVar("--red",      "#ef5b5b");
    const COLOR_AMBER  = cssVar("--amber",    "#f0b429");

    // Aborted flag: set synchronously in the cleanup so that the async .then()
    // callback can bail out if React StrictMode (or a fast re-render) already
    // unmounted this effect before the import promise resolved.
    let aborted = false;
    let destroyChart = null;

    import("lightweight-charts").then((lc) => {
      // Bail out if cleanup already ran (StrictMode double-invoke, unmount, etc.)
      if (aborted || !containerRef.current) return;

      const {
        createChart,
        CrosshairMode,
        LineStyle,
        CandlestickSeries,
        LineSeries,
        HistogramSeries,
      } = lc;

      const el = containerRef.current;


      const chart = createChart(el, {
        width:  el.clientWidth,
        height: 380,
        layout: {
          background: { color: COLOR_BG },
          textColor:  COLOR_DIM,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          fontSize:   11,
        },
        grid: {
          vertLines: { color: COLOR_BORDER, style: LineStyle.Dotted },
          horzLines: { color: COLOR_BORDER, style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: COLOR_ACCENT, labelBackgroundColor: COLOR_ACCENT },
          horzLine: { color: COLOR_ACCENT, labelBackgroundColor: COLOR_ACCENT },
        },
        rightPriceScale: {
          borderColor:  COLOR_BORDER,
          textColor:    COLOR_DIM,
          scaleMargins: { top: 0.08, bottom: 0.22 },
        },
        timeScale: {
          borderColor:    COLOR_BORDER,
          timeVisible:    true,
          secondsVisible: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale:  { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      });

      chartRef.current = chart;

      // Candlestick series
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor:         COLOR_GREEN,
        downColor:       COLOR_RED,
        borderUpColor:   COLOR_GREEN,
        borderDownColor: COLOR_RED,
        wickUpColor:     COLOR_GREEN,
        wickDownColor:   COLOR_RED,
        priceFormat:     { type: "price", precision: 2, minMove: 0.01 },
      });
      candleSeries.setData(ohlcv);

      // Volume histogram
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceFormat:  { type: "volume" },
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        visible: false,
      });
      volumeSeries.setData(
        ohlcv.map((bar) => ({
          time:  bar.time,
          value: bar.volume,
          color: bar.close >= bar.open
            ? "rgba(62,207,142,0.30)"
            : "rgba(239,91,91,0.30)",
        }))
      );

      // SMA20
      if (sma20Line.length > 0) {
        const s20 = chart.addSeries(LineSeries, {
          color:                  COLOR_ACCENT,
          lineWidth:              1.5,
          crosshairMarkerVisible: false,
          lastValueVisible:       true,
          priceLineVisible:       false,
          title:                  "SMA20",
        });
        s20.setData(sma20Line);
      }

      // SMA50
      if (sma50Line.length > 0) {
        const s50 = chart.addSeries(LineSeries, {
          color:                  COLOR_AMBER,
          lineWidth:              1.5,
          crosshairMarkerVisible: false,
          lastValueVisible:       true,
          priceLineVisible:       false,
          title:                  "SMA50",
        });
        s50.setData(sma50Line);
      }

      // 6-month high reference line
      if (high6mo != null) {
        candleSeries.createPriceLine({
          price:            high6mo,
          color:            COLOR_GREEN,
          lineWidth:        1,
          lineStyle:        LineStyle.Dashed,
          axisLabelVisible: true,
          title:            "6mo H  " + high6mo,
        });
      }

      // 6-month low reference line
      if (low6mo != null) {
        candleSeries.createPriceLine({
          price:            low6mo,
          color:            COLOR_RED,
          lineWidth:        1,
          lineStyle:        LineStyle.Dashed,
          axisLabelVisible: true,
          title:            "6mo L  " + low6mo,
        });
      }

      // Latest close price line
      if (latestClose != null) {
        candleSeries.createPriceLine({
          price:            latestClose,
          color:            COLOR_TEXT,
          lineWidth:        1,
          lineStyle:        LineStyle.Solid,
          axisLabelVisible: true,
          title:            "Close",
        });
      }

      chart.timeScale().fitContent();

      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) chart.applyOptions({ width: w });
        }
      });
      ro.observe(el);

      // Register the destructor — only reachable if aborted was false
      destroyChart = () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
      };
    }).catch((err) => {
      console.error("[StockChart] lightweight-charts load error:", err);
    });

    return () => {
      // Set aborted FIRST so any still-pending .then() callback skips chart creation
      aborted = true;
      // If the chart was already created, tear it down
      if (destroyChart) destroyChart();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ohlcv]);


  if (!ohlcv || ohlcv.length === 0) return null;

  return (
    <div className="stock-chart-wrap">
      <div className="stock-chart-header">
        <span className="stock-chart-title">
          {ticker ? ticker + " · " : ""}Daily Price · 6 months
        </span>
        <span className="stock-chart-legend">
          <span className="legend-dot legend-dot--accent"></span>SMA20
          <span className="legend-dot legend-dot--amber"></span>SMA50
          <span className="legend-dot legend-dot--green"></span>Vol Up
          <span className="legend-dot legend-dot--red"></span>Vol Down
        </span>
      </div>
      <div ref={containerRef} style={{ width: "100%" }} />
    </div>
  );
}
