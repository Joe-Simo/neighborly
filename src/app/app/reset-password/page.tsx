import Link from "next/link";
import { LiveResetPassword } from "@/components/live-auth";
export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return code ? (
    <LiveResetPassword code={code} />
  ) : (
    <main className="live-auth">
      <h1>This link is incomplete.</h1>
      <p>Open the full link from your password recovery email.</p>
      <Link className="live-link" href="/app">
        Return to sign in
      </Link>
    </main>
  );
}
