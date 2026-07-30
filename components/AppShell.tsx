import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * The page frame: one column, mobile-first, with the same rhythm on every route.
 *
 * Screens differ only in what they put inside it, so the spacing between the
 * header, the content and the footnote cannot drift from one route to the next.
 */
export function AppShell({
  title,
  subtitle,
  back,
  children,
}: {
  /** A node rather than a string, so the homepage can head the page with the wordmark. */
  title: React.ReactNode;
  subtitle?: string;
  /** Renders the back control. Omitted on the homepage, which has nowhere to go. */
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      <header className="mb-7">
        {back && (
          <Link
            href={back.href}
            className="-ml-2 mb-5 inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-medium text-ink-500 transition hover:bg-white/70 hover:text-ink-900 focus-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {back.label}
          </Link>
        )}

        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900 sm:text-3xl">
          {title}
        </h1>

        {subtitle && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-500">{subtitle}</p>}
      </header>

      <div className="space-y-5">{children}</div>

      <p className="mt-10 text-center text-xs leading-relaxed text-ink-400">
        Readings are estimates only — your DISCO&rsquo;s meter reading is final.
      </p>
    </main>
  );
}
