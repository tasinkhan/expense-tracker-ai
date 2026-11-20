"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-md px-6 py-14 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">An unexpected error occurred. Your saved data is safe.</p>
      <button onClick={reset} className="btn-primary mt-6">Try again</button>
    </div>
  );
}
