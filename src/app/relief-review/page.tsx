import Link from "next/link";
import type { Metadata } from "next";
import { OriginalReliefReview } from "@/components/original-relief-review";
import "./review.css";

export const metadata: Metadata = { title: "Original artwork — Kind Helps", robots: { index: false, follow: false } };

export default function ReliefReviewPage() {
  return <main className={"monumental-review"}>
    <header className={"monumental-review-header"}><Link href="/" className={"monumental-review-brand"}>kind helps</Link><span>ORIGINAL ART · REFERENCE</span><Link href="/">Back to Kind Helps</Link></header>
    <section aria-labelledby="relief-heading">
      <div className={"monumental-review-intro"}><p>Good work, together.</p><h1 id="relief-heading">A place for your people.</h1><p>The original artwork and proportions.</p></div>
      <OriginalReliefReview />
    </section>
    <footer className={"monumental-review-footer"}><p>Artwork review. Your group’s people and plans remain in its private workspace.</p><nav aria-label="Get started"><Link href="/app?intent=start">Start a group <span aria-hidden="true">↗</span></Link><Link href="/app?intent=join">Join your people <span aria-hidden="true">↗</span></Link></nav></footer>
  </main>;
}
