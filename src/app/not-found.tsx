import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-red-500/10 text-red-500 font-mono font-bold text-lg mb-4">
        404
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-page)]">Page Not Found</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        The documentation page you are looking for does not exist or may have been moved.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="btn-accent inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
        >
          Return to Documentation Home
        </Link>
      </div>
    </div>
  );
}
