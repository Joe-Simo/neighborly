import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import "./hall-interior-study.css";

/** Art review composition before the interior joins the continuous camera path. */
export function HallInteriorStudy() {
  return <main className="hall-interior-study">
    <Image src="/assets/threshold/hall-interior-v3.webp" fill sizes="200vw" quality={90} priority alt="A church community preparing bread, flowers and a shared table in a sunlit stone hall." />
    <div className="hall-interior-copy"><p>Faith, lived out.</p><h1>Good work.<br /><em>Together.</em></h1><p>A little of each of us.<br />Something good for all of us.</p><Button asChild><Link href="/app?intent=start">Start a group</Link></Button><Link href="/depth-study">Return to the courtyard</Link></div>
  </main>;
}
