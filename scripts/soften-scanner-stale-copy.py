"""Rewrite customer-facing 'run on your PC' fallback messages."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRIENDLY = "Data is refreshing. Check back shortly."

KEYWORDS = (
    "on your pc",
    "python ",
    ".py",
    "run the",
    "run scanners",
    "not uploaded yet",
    "has not been built",
    "rebuild with",
    "run scanner_",
    "run build_",
)


def should_replace(body: str) -> bool:
    low = body.lower()
    return any(k in low for k in KEYWORDS)


def main() -> None:
    files: list[Path] = []
    files.extend((ROOT / "lib").glob("scanner-*-data.ts"))
    files.extend(
        [
            ROOT / "lib" / "scanner-agents.ts",
            ROOT / "lib" / "scanner-instructions.ts",
            ROOT / "lib" / "scanner-cockpit-forward.ts",
            ROOT / "app" / "scanner" / "cockpit" / "ScannerCockpitClient.tsx",
            ROOT / "app" / "scanner" / "agents" / "ScannerAgentsClient.tsx",
            ROOT / "app" / "scanner" / "options-institutions" / "OptionsInstitutionsClient.tsx",
            ROOT / "app" / "scanner" / "cot" / "CotReportClient.tsx",
            ROOT / "app" / "scanner" / "elliott-wave" / "ElliottWaveClient.tsx",
            ROOT / "components" / "scanner" / "FirstPullbackRegimeCard.tsx",
        ]
    )

    changed: list[str] = []
    for path in files:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        orig = text

        def repl_message(match: re.Match[str]) -> str:
            quote = match.group(1)
            body = match.group(2)
            if should_replace(body):
                return f"message: {quote}{FRIENDLY}{quote}"
            return match.group(0)

        # Single-line message: '...'
        text = re.sub(r"message:\s*(['\"])([^'\"]+)\1", repl_message, text)

        # Parenthesized multi-line message: ("a" "b") or ('a')
        def repl_paren(match: re.Match[str]) -> str:
            inner = match.group(0)
            if should_replace(inner):
                return f'message:\n      "{FRIENDLY}",'
            return inner

        text = re.sub(
            r"message:\s*\(\s*(?:['\"][^'\"]*['\"]\s*)+\)\s*,?",
            repl_paren,
            text,
            flags=re.MULTILINE,
        )

        # Specific JSX leftovers
        replacements = [
            (
                r'Run <code className="[^"]*">python[^<]*</code> after a scanner refresh\.',
                FRIENDLY,
            ),
            (
                r"No scanner flow data yet\. Run the morning scan refresh on your PC to populate picks\.",
                FRIENDLY,
            ),
            (
                r"\{forward\?\.message \|\| '[^']*PC\.'\}",
                "{forward?.message || '" + FRIENDLY + "'}",
            ),
            (
                r"\{forward\?\.message \|\| \"[^\"]*PC\.\"\}",
                '{forward?.message || "' + FRIENDLY + '"}',
            ),
        ]
        for pattern, repl in replacements:
            text = re.sub(pattern, repl, text)

        # First pullback / elliott code chips that are the whole hint
        text = re.sub(
            r"(?:Run\s+)?<code className=\"text-zinc-300\">[^<]*(?:\.py|--upload)[^<]*</code>\.?",
            FRIENDLY,
            text,
        )
        text = re.sub(
            r"No trend charts yet — rebuild with\s+" + re.escape(FRIENDLY) + r"\s*\{' '?\}[^<]*",
            FRIENDLY,
            text,
        )

        if text != orig:
            path.write_text(text, encoding="utf-8")
            changed.append(str(path.relative_to(ROOT)))

    print(f"changed {len(changed)}")
    for item in changed:
        print(item)


if __name__ == "__main__":
    main()
