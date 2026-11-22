"use client";

import { memo, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { useFirstLook } from "@/components/workspace/first-look";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { languageNames, languages, learnBook, type Language, type Words } from "@/lib/words";
import type { Id } from "../../../convex/_generated/dataModel";
import { takeEntryLanguage, useEntryLanguage } from "@/components/live-auth-words";
import { api } from "../../../convex/_generated/api";

const carried = new Set<string>();

/** The person's language, and the way to change it. A failed change says so where they are looking. */
function useLanguage(words: Words, churchId: Id<"churches">) {
  const save = useMutation(api.language.choose);
  const adopt = useMutation(api.language.adopt);
  const [failed, setFailed] = useState(false);
  // Visitors to the sample share one made-up member, so their language is kept on their own device and never
  // saved: the rooms read the door's language for them (live-app.tsx), and choosing here changes that.
  const look = useFirstLook();
  // A look (the sample's seed, or a room kept on the device) writes nothing: until the live room is in, a language is
  // kept on the device as a visitor's is, so nothing is saved for a conference the person may no longer be in.
  const visiting = useQuery(api.demo.visiting, {}) ?? (look ? true : undefined);
  const [, setOnDevice] = useEntryLanguage();
  // The door and the rooms speak one language: what the person pressed on the entry sheet is saved here, and
  // the device's own language fills in for someone who has never chosen. Once per conference and visit.
  useEffect(() => {
    if (visiting !== false || carried.has(churchId)) return;
    carried.add(churchId);
    const entry = takeEntryLanguage();
    void (entry.pressed ? save : adopt)({ churchId, language: entry.language }).catch(() => carried.delete(churchId));
  }, [churchId, save, adopt, visiting]);
  return {
    words,
    current: words.locale,
    failed,
    choose: (language: Language) => {
      setFailed(false);
      if (language === words.locale) return;
      // The new language's book is fetched first, and only then is the language changed: the rooms turn straight to it.
      learnBook(language)
        .then(() => (visiting ? setOnDevice(language) : save({ churchId, language })))
        .catch(() => setFailed(true));
    },
  };
}

/**
 * In the header: a quiet line of text, the language named in itself, so it can
 * be found from any other. It carries no more weight than the person's name beside it.
 */
export const LanguageChooser = memo(function LanguageChooser({ words: book, churchId }: { words: Words; churchId: Id<"churches"> }) {
  const { words, current, failed, choose } = useLanguage(book, churchId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${words.shell.language}: ${languageNames[current]}`} className="h-11 gap-2 border-0 bg-transparent px-2 !text-[15px] font-normal text-[#5d6a56] shadow-none hover:text-[#243b2c]">
          <Languages size={16} aria-hidden="true" />
          <span lang={current}>{languageNames[current]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-[#f7f4ed] p-1.5">
        <DropdownMenuRadioGroup value={current} onValueChange={(value) => { const language = languages.find((candidate) => candidate === value); if (language) choose(language); }}>
          {languages.map((language) => (
            <DropdownMenuRadioItem key={language} value={language} lang={language} className="min-h-11 text-[17px] text-[#243b2c] focus:bg-[#e5eadc] focus:text-[#243b2c]">
              {languageNames[language]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="bg-[#d9ddce]" />
        <DropdownMenuLabel className="text-[15px] leading-snug font-normal text-[#5d6a56]">
          {failed ? <span role="alert" className="text-[#6f5f93]">{words.notices.failed}</span> : words.shell.typedStays}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
