"use client";

import Link from "next/link";

export default function TeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
      <header className="border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ClawCompany AI Team</h1>
          </div>
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            Back to Home
          </Link>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div className="text-5xl mb-4">🦞</div>
          <h2 className="text-2xl font-bold mb-3">Team Chat Error</h2>
          <p className="text-gray-400 mb-2">
            Something went wrong with the team collaboration system.
          </p>
          {error.message && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-2 mb-6 font-mono break-all">
              {error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
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
