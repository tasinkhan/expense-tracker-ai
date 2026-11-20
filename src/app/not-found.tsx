import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md px-6 py-14 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <Link href="/" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
