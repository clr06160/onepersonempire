'use client';

import { useCallback, useEffect, useState } from 'react';

import ScannerExtrasNav from '@/app/scanner/_extras/ScannerExtrasNav';

type UserRow = {
  email: string;
  name?: string | null;
  role: 'viewer' | 'developer';
  active: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  source?: 'firestore' | 'allowlist' | 'waitlist';
  hasSignedIn?: boolean;
};

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function sourceLabel(source?: UserRow['source']) {
  if (source === 'allowlist') return 'Allowlist';
  if (source === 'waitlist') return 'Waitlist';
  return 'Account';
}

function UsersTable({
  rows,
  busyEmail,
  onSetActive,
  empty,
}: {
  rows: UserRow[];
  busyEmail: string;
  onSetActive: (email: string, active: boolean) => void;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-zinc-500">
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Last login</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.email} className="border-b border-zinc-900/80">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-100">{row.email}</div>
                {row.name ? <div className="text-xs text-zinc-500">{row.name}</div> : null}
              </td>
              <td className="px-4 py-3 capitalize text-zinc-300">{row.role}</td>
              <td className="px-4 py-3 text-zinc-400">{sourceLabel(row.source)}</td>
              <td className="px-4 py-3">
                <span className={row.active ? 'text-emerald-300' : 'text-amber-300'}>
                  {row.active ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-400">{fmt(row.lastLoginAt)}</td>
              <td className="px-4 py-3 text-zinc-400">{fmt(row.createdAt)}</td>
              <td className="px-4 py-3">
                {row.active ? (
                  <button
                    type="button"
                    disabled={busyEmail === row.email}
                    onClick={() => onSetActive(row.email, false)}
                    className="rounded-lg border border-amber-800/60 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-600 disabled:opacity-50"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyEmail === row.email}
                    onClick={() => onSetActive(row.email, true)}
                    className="rounded-lg border border-emerald-800/60 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:border-emerald-600 disabled:opacity-50"
                  >
                    Re-enable
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScannerUsersClient() {
  const [all, setAll] = useState<UserRow[]>([]);
  const [signedIn, setSignedIn] = useState<UserRow[]>([]);
  const [tab, setTab] = useState<'all' | 'signedIn'>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/scanner/users', { credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Could not load users.');
        setAll([]);
        setSignedIn([]);
        return;
      }
      setAll(payload.all || []);
      setSignedIn(payload.signedIn || []);
    } catch {
      setError('Could not load users.');
      setAll([]);
      setSignedIn([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setActive(email: string, active: boolean) {
    setBusyEmail(email);
    setError('');
    try {
      const response = await fetch('/api/scanner/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, active }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Update failed.');
        return;
      }
      await load();
    } catch {
      setError('Update failed.');
    } finally {
      setBusyEmail('');
    }
  }

  const rows = tab === 'all' ? all : signedIn;

  return (
    <>
      <ScannerExtrasNav active="/scanner/users" />
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">Developer</p>
        <h1 className="mt-2 text-3xl font-bold">Users</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Open signup is on. <strong className="font-medium text-zinc-300">All users</strong> includes accounts,
          allowlist, and waitlist. <strong className="font-medium text-zinc-300">Signed in</strong> is anyone who has
          logged in at least once. Disable / re-enable works on either list.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'all'
              ? 'border-emerald-600 bg-emerald-950/50 text-emerald-200'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
          }`}
        >
          All users ({all.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('signedIn')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            tab === 'signedIn'
              ? 'border-emerald-600 bg-emerald-950/50 text-emerald-200'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
          }`}
        >
          Signed in ({signedIn.length})
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <UsersTable
          rows={rows}
          busyEmail={busyEmail}
          onSetActive={(email, active) => void setActive(email, active)}
          empty={
            tab === 'signedIn'
              ? 'Nobody has signed in yet. After the first open sign-ins, they show here.'
              : 'No users, allowlist emails, or waitlist entries yet.'
          }
        />
      )}
    </>
  );
}
