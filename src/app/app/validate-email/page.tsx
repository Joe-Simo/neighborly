import Link from "next/link";
import { LiveValidateEmail } from "@/components/live-auth";
export default async function ValidateEmail({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return code ? (
    <LiveValidateEmail code={code} />
  ) : (
    <main className="live-auth">
      <h1>This link is incomplete.</h1>
      <p>Open the full link from your validation email.</p>
      <Link className="live-link" href="/app">
        Return to sign in
      </Link>
    </main>
  );
}
