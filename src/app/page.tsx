import { ClientOnly } from "@/components/client-only";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Workspace } from "@/components/workspace";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <section className="py-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">For church volunteers</p>
          <h1 className="font-display mt-3 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Invite your neighbors in the languages they speak at home.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-mute">
            Neighborly finds the languages around your church from Census data, drafts each announcement with AI, checks every time and address by code, and waits for a fluent volunteer to approve every line.
          </p>
          <ol className="mt-6 flex flex-wrap gap-2 text-sm font-medium" aria-label="Steps">
            {["Neighbors", "Announcement", "Translate and review", "Publish"].map((s, i) => (
              <li key={s}>
                <a href={`#${["neighbors", "announcement", "review", "publish"][i]}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 hover:border-accent">
                  <span className="font-display text-accent">{i + 1}</span> {s}
                </a>
              </li>
            ))}
          </ol>
        </section>
        <ClientOnly fallback={<div className="card h-96 shimmer" aria-label="Loading the workspace" />}>
          <Workspace />
        </ClientOnly>
      </main>
      <SiteFooter />
    </>
  );
}
