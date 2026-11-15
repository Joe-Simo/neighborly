import { ClientOnly } from "@/components/client-only";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Hero } from "@/components/hero";
import { Workspace } from "@/components/workspace";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-7xl px-4 pb-8 sm:px-8">
        <ClientOnly fallback={<Hero />}>
          <Workspace />
        </ClientOnly>
      </main>
      <SiteFooter />
    </>
  );
}
