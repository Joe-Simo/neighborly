import Link from "next/link";

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0e6b66" />
      <path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1h-4.5v-5.5h-5V25H9a1 1 0 0 1-1-1z" fill="#faf7f1" />
      <circle cx="22.5" cy="10" r="3" fill="#e0a83e" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg">
          <Logo />
          <span className="font-display text-xl font-semibold tracking-tight">Neighborly</span>
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 text-sm font-medium">
          <Link href="/" className="rounded-full px-3 py-2 hover:bg-accent-soft">Workspace</Link>
          <Link href="/limits" className="rounded-full px-3 py-2 hover:bg-accent-soft">Limits and safeguards</Link>
          <a href="https://github.com/Joe-Simo/neighborly" className="hidden rounded-full px-3 py-2 hover:bg-accent-soft sm:inline">Code</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-mute sm:grid-cols-3 sm:px-6">
        <p>
          <strong className="text-ink">AI use:</strong> translations and back-translations come from free open models on OpenRouter. A fluent person approves every block before anything can be exported.
        </p>
        <p>
          <strong className="text-ink">Data:</strong> language counts are US Census ACS 2024 5-year estimates (table C16001). Your text stays in your browser, except when it is sent to be translated.
        </p>
        <p>
          <strong className="text-ink">Sample data:</strong> Grace Fellowship, its address, phone and email are fictional. No real church member data is used. Built for the AI for Church Hackathon 2026. MIT license.
        </p>
      </div>
    </footer>
  );
}
