import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-red-500/10 text-red-500 font-mono font-bold text-lg mb-4">
        404
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        The documentation page you are looking for does not exist or may have been moved.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          Return to Documentation Home
        </Link>
      </div>
    </div>
  );
}
