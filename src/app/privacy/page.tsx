import { linkPreview } from "@/lib/link-preview";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PublicEnding } from "@/components/public-ending";
import "@/components/public-page.css";

export const metadata: Metadata = {
  title: "Privacy — Kind Helps",
  description: "What a conference keeps in Kind Helps, who can see it, what the assistant is sent, and how a record, a person or a whole conference is removed.",
  alternates: { canonical: "/privacy" },
  openGraph: { ...linkPreview, url: "/privacy", title: "Privacy — Kind Helps", description: "What a conference keeps in Kind Helps, who can see it, and how it is removed." },
};

export default function Privacy() {
  return <div className="public-page">
    <header className="public-page-header">
      <Link className="public-page-brand" href="/">kind helps</Link>
      <Link href="/app">Enter Kind Helps<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <main className="public-words paper-rise">
      <h1>Privacy</h1>
      <div className="public-words-relief" aria-hidden="true" />
      <section>
        <h2>Your records belong to your conference</h2>
        <div><p>Kind Helps is free software for a conference to keep its own work in one place. What a conference writes here belongs to the conference, not to us.</p></div>
      </section>
      <section>
        <h2>What a conference keeps here</h2>
        <div><ul>
          <li><strong>Its members:</strong> name, email, role, teams, availability, time off, commitments, tasks, meetings and announcements.</li>
          <li><strong>The neighbors it helps:</strong> name, phone, email, address, how many adults and children, language and notes. If the conference chooses to record them: who lives in the household by relationship and birth year (no names, no birth dates), monthly income and expenses, and landlord or utility account details.</li>
          <li><strong>Its work:</strong> calls to the help line, requests for help and home visits.</li>
          <li><strong>Its money:</strong> the ledger, deposits, who is paid, vouchers and bank statement balances.</li>
        </ul></div>
      </section>
      <section>
        <h2>Who can see it</h2>
        <div>
          <p>Only people signed in to that conference. Neighbors’ records, calls, requests, visits and the ledger open to the conference’s owner and coordinators only. Other members see their own commitments and teams. One conference cannot see another’s records.</p>
          <p>Opening a neighbor’s record is written in the conference’s own log, with who and when. So is each request to see a full account number, and each download of the conference’s records. A list or search of neighbors shows each household’s name, street, size, when it was last helped, and any open request or planned visit, and is not logged. Phone numbers, email, notes, household members, money and accounts reach the screen only when a record is opened.</p>
        </div>
      </section>
      <section>
        <h2>Signing in and where records are held</h2>
        <div><p>Sign-in is handled by Clerk, which keeps your email address and your sign-in. The conference’s records are held in a Convex database. The site is served by Vercel. Each of these companies has its own privacy terms, which apply to what it holds.</p></div>
      </section>
      <section>
        <h2>The assistant</h2>
        <div>
          <p>The assistant reads a call note and answers set questions about it: what kind of help is asked for, whether it is urgent, whether a record looks finished. It does not write text and it saves nothing by itself. A person reads every suggestion and decides.</p>
          <p>Everything sent to the assistant first passes through one step that takes out names, phone numbers, email addresses and street addresses. On any draft, “What the assistant saw” shows the note exactly as it was sent. The assistant is Jev, run by Typesafe.</p>
          <p>That step works by fixed rules, so an unusual spelling could slip through. Write in a note only what the conference would be content to have read.</p>
        </div>
      </section>
      <section>
        <h2>What we do not do</h2>
        <div>
          <p>No advertising. We do not sell or share records. The site loads no analytics or tracking scripts. The only outside services it uses are the ones named on this page.</p>
          <p>So that it can open without a connection, the app keeps its own pages, pictures and fonts on your device. It does not keep your conference’s records there.</p>
        </div>
      </section>
      <section>
        <h2>The sample conference</h2>
        <div><p>“Look around a sample conference” opens a conference of made-up people with made-up phone numbers. It is rebuilt every night, and anything typed into it is thrown away then.</p></div>
      </section>
      <section>
        <h2>Removing a record, a person or a whole conference</h2>
        <div>
          <p>Ask the owner of your conference first. The records are theirs, and only an owner can remove them. Each removal asks the owner to type the name, and it cannot be undone.</p>
          <ul>
            <li><strong>A neighbor’s record.</strong> The record is erased, and the name and details are taken out of that household’s calls, requests, visits and ledger lines. The year’s totals stay as they were, with no name.</li>
            <li><strong>A person in the conference.</strong> Their name, email, language, teams, availability, time off and the link to their sign-in are erased. The visits and hours they gave still count in the year, signed “A former member”.</li>
            <li><strong>A whole conference.</strong> The owner is offered a download of the records first. Then everything the conference kept here is removed.</li>
          </ul>
          <p>One limit, said plainly: a name someone typed by hand somewhere else, such as in a note on another record, a task or an announcement, is not searched for. The owner should look for those and change them.</p>
          <p>Your sign-in itself is held by Clerk. Removing a person here removes their place in the conference, not their Clerk account.</p>
        </div>
      </section>
      <section>
        <h2>Questions</h2>
        <div>
          <p>For the software itself, or if you cannot reach an owner, open an issue on the project’s public page: <a href="https://github.com/Joe-Simo/neighborly" target="_blank" rel="noopener noreferrer">github.com/Joe-Simo/neighborly</a>. Please do not put personal details in a public issue.</p>
          <p className="public-words-last">Kind Helps is an independent project. It is not affiliated with or endorsed by the Society of St. Vincent de Paul.</p>
        </div>
      </section>
    </main>
    <PublicEnding />
  </div>;
}
