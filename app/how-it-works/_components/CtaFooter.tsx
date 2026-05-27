// app/how-it-works/_components/CtaFooter.tsx
import Link from 'next/link';

export function CtaFooter() {
  return (
    <section className="bg-blue-600">
      <div className="mx-auto max-w-5xl px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-white">Ready to practice?</h2>
        <p className="mt-2 text-sm text-blue-100">
          Free for now. Daily test limit is admin-configurable.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Sign in to start practicing
          </Link>
          <Link href="/register" className="text-sm text-blue-100 hover:text-white">
            New here? Create an account
          </Link>
        </div>
      </div>
    </section>
  );
}
