import Link from 'next/link';

/** Shared nav across all scanner pages (picks, instructions, FMP, COT, monitor). */
const links = [
  { href: '/scanner', label: 'System scanner' },
  { href: '/scanner/instructions', label: 'Instructions' },
  { href: '/scanner/monitor', label: 'Adaptive monitor' },
  { href: '/scanner/fmp', label: 'FMP fundamentals' },
  { href: '/scanner/cot', label: 'COT report' },
  { href: '/scanner/requests', label: 'Request a scan' },
];

export default function ScannerExtrasNav({ active }: { active: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            active === link.href
              ? 'border-emerald-500 bg-emerald-950 text-emerald-200'
              : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
