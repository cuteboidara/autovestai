'use client';

export default function GlobalError() {
  return (
    <html lang="en">
      <body className="m-0 min-h-screen bg-slate-950 text-white">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Critical Error
          </p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-[-0.03em]">
              AutovestAI could not render this workspace.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              Refresh the session or return to the main portal entry point.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950"
          >
            Return Home
          </button>
        </main>
      </body>
    </html>
  );
}
