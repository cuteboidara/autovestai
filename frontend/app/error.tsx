'use client';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Application Error
      </p>
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          The page hit an unexpected error.
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-400">
          Reload the route or return to a stable workspace area. If the problem
          persists, inspect the latest request logs in Control Tower.
        </p>
        <p className="text-xs text-slate-500">
          {error.digest ?? error.message}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950"
      >
        Try Again
      </button>
    </main>
  );
}
