/** Shared footer for all /scanner pages: disclaimer + trademark attribution. */
export default function ScannerFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-8 text-zinc-500">
      <div className="mx-auto max-w-7xl space-y-3 text-xs leading-relaxed">
        <p className="font-semibold uppercase tracking-wide text-zinc-400">
          Disclaimer &amp; attribution
        </p>
        <p>
          For educational and informational purposes only. Nothing here is financial,
          investment, tax, or legal advice, or a recommendation to buy or sell any security.
          Forward-tested and backtested results are hypothetical, do not represent actual
          trading, and past performance does not guarantee future results. Trade at your own risk.
        </p>
        <p>
          &ldquo;Power Trend&rdquo; is a market signal concept developed by Investor&rsquo;s
          Business Daily (IBD). &ldquo;CAN SLIM&rdquo; is a registered trademark of Investor&rsquo;s
          Business Daily, LLC. This site implements similar concepts independently and is{' '}
          <span className="font-medium text-zinc-400">
            not affiliated with, endorsed by, or sponsored by Investor&rsquo;s Business Daily, LLC
          </span>
          . All trademarks are the property of their respective owners.
        </p>
        <p className="text-zinc-600">© {year} The Morning Scan. All rights reserved.</p>
      </div>
    </footer>
  );
}
