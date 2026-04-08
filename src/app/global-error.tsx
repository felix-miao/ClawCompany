"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-white min-h-screen flex items-center justify-center">
        <div className="text-center px-6 max-w-lg">
          <div className="text-6xl mb-6">💀</div>
          <h1 className="text-3xl font-bold mb-3">Something went wrong</h1>
          <p className="text-gray-400 mb-2">
            An unexpected error occurred in the application.
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
            <a
              href="/"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors border border-white/10"
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
