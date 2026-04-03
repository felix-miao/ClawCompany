"use client";

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <div className="text-center px-6 max-w-lg">
        <div className="text-5xl mb-4">🏠</div>
        <h2 className="text-2xl font-bold mb-3">Home Page Error</h2>
        <p className="text-gray-400 mb-2">
          Something went wrong on the home page.
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
        </div>
      </div>
    </div>
  );
}
