import Link from 'next/link'

const fallbackAgents = [
  {
    id: 'pm-agent',
    name: 'PM Claw',
    role: 'Project Manager',
    status: 'snapshot fallback',
    desk: 'Planning Desk',
  },
  {
    id: 'dev-agent',
    name: 'Dev Claw',
    role: 'Developer',
    status: 'snapshot fallback',
    desk: 'Build Station',
  },
  {
    id: 'review-agent',
    name: 'Reviewer Claw',
    role: 'Code Reviewer',
    status: 'snapshot fallback',
    desk: 'Review Bay',
  },
]

export default function OfficePage() {
  return (
    <main className="min-h-screen bg-dark px-6 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 transition-colors hover:text-white">
              View live dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold gradient-text">Office</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Snapshot fallback office surface for the core ClawCompany roles. Use Dashboard for live OpenClaw session data.
            </p>
          </div>
          <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-yellow-200">
            snapshot fallback
          </div>
        </header>

        <section
          data-testid="office-surface"
          className="grid gap-4 rounded-3xl border border-dark-100 bg-dark-50/40 p-4 shadow-2xl lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-primary-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
            <canvas
              aria-label="Office canvas overview"
              className="absolute inset-0 h-full w-full opacity-20"
              height={360}
              width={760}
            />
            <div className="relative grid h-full gap-4 sm:grid-cols-3">
              {fallbackAgents.map(agent => (
                <article
                  key={agent.id}
                  data-testid={`agent-card-${agent.id}`}
                  className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"
                >
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-primary-300">{agent.desk}</div>
                    <h2 className="mt-3 text-lg font-semibold text-white">{agent.name}</h2>
                    <p className="mt-1 text-sm text-gray-400">{agent.role}</p>
                  </div>
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                    {agent.status}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-dark-100 bg-dark/50 p-4">
            <h2 className="text-lg font-semibold">Office Roles</h2>
            <p className="mt-2 text-sm text-gray-400">
              This entrance stays visible even when live agent snapshots are unavailable, and labels the cards as fallback state to avoid implying live work.
            </p>
            <div className="mt-4 space-y-3">
              {fallbackAgents.map(agent => (
                <div key={agent.id} className="rounded-xl border border-dark-100 bg-dark-50/50 p-3">
                  <div className="text-sm font-medium text-white">{agent.role}</div>
                  <div className="mt-1 text-xs text-gray-500">{agent.desk}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
