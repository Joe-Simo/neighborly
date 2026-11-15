"use client";

import { useEffect, useRef } from "react";
import { ArrowUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArtworkView } from "@/lib/artwork";
import "./artwork-chapters.css";

const chapters = [
  { id: "belong", label: "Belong", view: "person", number: "01", title: <>A place for<br /><em>your people.</em></>, copy: "Your church. Your community. A shared place for the people who make it yours." },
  { id: "choose", label: "Choose", view: "exchange", number: "02", title: <>A willing yes.<br /><em>Never assumed.</em></>, copy: "An invitation leaves room for a choice. A responsibility begins when someone says yes." },
  { id: "prepare", label: "Prepare", view: "preparation", number: "03", title: <>Clear plans.<br /><em>Room for life.</em></>, copy: "Know what needs doing and who is helping. When plans change, ask for cover without losing your place on the team." },
] as const;

export type ArtworkChapter = typeof chapters[number]["id"];
export const chapterView = (chapter: ArtworkChapter | null): ArtworkView =>
  chapters.find(({ id }) => id === chapter)?.view ?? "group";

function isChapter(value: string): value is ArtworkChapter {
  return chapters.some(({ id }) => id === value);
}

export function ArtworkChapters({ value, onChange, onExit }: {
  value: ArtworkChapter;
  onChange: (value: ArtworkChapter) => void;
  onExit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return <Tabs id="artwork-story" value={value} onValueChange={(next) => { if (isChapter(next)) onChange(next); }} className="artwork-chapters" activationMode="automatic">
    <div className="artwork-chapter-navigation">
      <Button variant="ghost" className="artwork-chapter-return" onClick={onExit}><ArrowUpLeft aria-hidden="true" /> The whole picture</Button>
      <TabsList variant="line" aria-label="Our way of working">
        {chapters.map((chapter) => <TabsTrigger key={chapter.id} value={chapter.id}><span aria-hidden="true">{chapter.number}</span>{chapter.label}</TabsTrigger>)}
      </TabsList>
    </div>
    {chapters.map((chapter) => <TabsContent key={chapter.id} value={chapter.id} className="artwork-chapter-copy">
      <p className="artwork-chapter-eyebrow">Our way of working <span aria-hidden="true">/ {chapter.number}</span></p>
      <h2 tabIndex={-1} ref={chapter.id === value ? heading : undefined}>{chapter.title}</h2>
      <p className="artwork-chapter-description">{chapter.copy}</p>
    </TabsContent>)}
  </Tabs>;
}
