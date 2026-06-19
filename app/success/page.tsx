export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="text-emerald-400 font-semibold mb-3">Payment received</p>
        <h1 className="text-5xl font-bold tracking-tight mb-4">You&apos;re all set.</h1>
        <p className="text-zinc-400 text-lg">
          Thanks for your purchase. You can close this tab or return to the site.
        </p>
      </div>
    </main>
  );
}
