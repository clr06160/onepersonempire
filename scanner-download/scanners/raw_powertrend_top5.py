from __future__ import annotations

import argparse
from datetime import date
from typing import Any

import pandas as pd

from quality_regime_router_runner import PROJECT_ROOT, REPORTS_DIR
from tight_setup_acceleration_runner import TightConfig, parse_csv_ints, run_backtest, write_outputs


OUTPUT_PREFIX = f"iwm_weekly_accel_no_stop_{date.today().isoformat()}"


def write_focused_report(outputs: dict[str, Any], focused_summary: pd.DataFrame, prefix: str) -> None:
    best = focused_summary.sort_values(["cagr_pct", "max_drawdown_pct"], ascending=[False, False])
    lines = [
        "# IWM Weekly Acceleration No-Stop Test",
        "",
        f"Generated: {pd.Timestamp.now().isoformat(timespec='seconds')}",
        "",
        "## Method",
        "",
        "- Universe: IWM top 200 by latest cached dollar volume.",
        "- Selection: raw positive acceleration rank only.",
        "- Rebalance: weekly.",
        "- Stops: none.",
        "- Default window: 2021 to latest cached IWM date, approximating the last five years.",
        "- No margin, shorting, leveraged ETFs, fees, slippage, financing, or taxes.",
        "",
        "## No-Stop Weekly Rows",
        "",
        best.to_markdown(index=False) if not best.empty else "No weekly baseline rows found.",
        "",
        "## Outputs",
        "",
    ]
    for name, path in outputs.items():
        lines.append(f"- {name}: `{path.relative_to(PROJECT_ROOT)}`")
    (REPORTS_DIR / f"{prefix}_focused_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_focused(cfg: TightConfig) -> dict[str, Any]:
    summary, yearly, monthly, periods, trades, snapshots, rebalances, coverage, focus_years, checks = run_backtest(cfg)
    outputs = write_outputs(summary, yearly, monthly, periods, trades, snapshots, rebalances, coverage, focus_years, checks, cfg)

    focused = summary[
        summary["timing"].eq("weekly")
        & summary["setup_filter"].eq("baseline")
        & summary["stop_rule"].eq("none")
        & summary["macro_filter"].eq("none")
    ].copy()
    focused = focused.sort_values(["cagr_pct", "max_drawdown_pct"], ascending=[False, False])
    focused_path = REPORTS_DIR / f"{cfg.output_prefix}_focused_no_stop_summary.csv"
    focused.to_csv(focused_path, index=False)
    outputs["focused_no_stop_summary"] = focused_path
    write_focused_report(outputs, focused, cfg.output_prefix)
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Focused IWM top-200 weekly raw acceleration no-stop test.")
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-date")
    parser.add_argument("--iwm-top-count", type=int, default=200)
    parser.add_argument("--top-values", type=parse_csv_ints, default=(5, 10))
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--min-history-rows", type=int, default=260)
    parser.add_argument("--output-prefix", default=OUTPUT_PREFIX)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    cfg = TightConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        universe="iwm",
        iwm_top_count=max(1, int(args.iwm_top_count)),
        stop_grid="standard",
        top_values=args.top_values,
        frequencies=("weekly",),
        min_price=args.min_price,
        min_history_rows=args.min_history_rows,
        output_prefix=args.output_prefix,
    )
    outputs = run_focused(cfg)
    for name, path in outputs.items():
        print(f"{name}: {path}")
    print()
    focused = pd.read_csv(outputs["focused_no_stop_summary"])
    print(focused.to_string(index=False))


if __name__ == "__main__":
    main()
