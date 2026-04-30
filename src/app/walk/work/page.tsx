import Link from 'next/link'

const workspaceAreas = [
  'Task intake',
  'Implementation lane',
  'Review checkpoint',
]

export default function WalkWorkPage() {
  return (
    <main className="min-h-screen bg-dark px-6 py-8 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/office" className="text-sm text-gray-400 transition-colors hover:text-white">
              Back to Office
            </Link>
            <h1 className="mt-3 text-3xl font-bold gradient-text">Work Workspace</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Core work area for walking from the office into task execution. OpenClaw snapshot status is shown as fallback until live work data is attached.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-sm text-primary-100 transition-colors hover:bg-primary-500/20"
          >
            Open Dashboard
          </Link>
        </header>

        <section data-testid="walk-workspace" className="rounded-3xl border border-dark-100 bg-dark-50/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dark-100 pb-4">
            <div>
              <h2 className="text-xl font-semibold">Workspace Core</h2>
              <p className="mt-1 text-sm text-gray-400">OpenClaw snapshot fallback: no live task is claimed on this page.</p>
            </div>
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-yellow-200">
              fallback
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {workspaceAreas.map(area => (
              <article key={area} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="text-sm font-semibold text-white">{area}</div>
                <div className="mt-3 h-24 rounded-xl border border-dashed border-primary-500/25 bg-primary-500/5" />
                <p className="mt-3 text-xs text-gray-500">Ready for live OpenClaw work state.</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
