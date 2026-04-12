import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Error 404
      </p>
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          This page does not exist.
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-400">
          The requested route is unavailable or has been moved behind a different
          workspace path.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950"
        >
          Go Home
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200"
        >
          Open Login
        </Link>
      </div>
    </main>
  );
}
