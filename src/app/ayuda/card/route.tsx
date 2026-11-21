import { card } from "@/app/og-card/card";
import { intakeWords } from "@/lib/intake/intake-words";

// The Spanish "Ask for help" page is plain HTML from a route, so its shared-link card is a route of its own; it reads no request, so it is made once at build.

/** The page's own head beside the call it answers: the receiver lifted from its cradle. */
export function GET() {
  return card({ head: intakeWords.es.title, art: "assets/relief/relief-call-1536.webp" });
}
