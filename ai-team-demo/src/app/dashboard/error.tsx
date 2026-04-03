"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="glass border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            &larr; Back
          </Link>
          <h1 className="text-xl font-bold">Dashboard</h1>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-3">Dashboard Error</h2>
          <p className="text-gray-400 mb-2">
            Something went wrong loading the dashboard.
          </p>
          {error.message && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-2 mb-6 font-mono break-all">
              {error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 bg-[#FF5833] hover:bg-[#e04e2b] text-white font-semibold rounded-xl transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors border border-white/10"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
