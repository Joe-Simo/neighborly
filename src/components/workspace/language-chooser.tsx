"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
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
import { useWorkspace } from "@/components/workspace/context";
import { languageNames, languages, type Language } from "@/lib/words";
import { api } from "../../../convex/_generated/api";

/** The person's language, and the way to change it. A failed change says so where they are looking. */
function useLanguage() {
  const { data, words } = useWorkspace();
  const save = useMutation(api.language.choose);
  const [failed, setFailed] = useState(false);
  return {
    words,
    current: words.locale,
    failed,
    choose: (language: Language) => {
      setFailed(false);
      if (language !== words.locale) save({ churchId: data.church.id, language }).catch(() => setFailed(true));
    },
  };
}

/**
 * In the header: a quiet line of text, the language named in itself, so it can
 * be found from any other. It carries no more weight than the person's name beside it.
 */
export function LanguageChooser() {
  const { words, current, failed, choose } = useLanguage();
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
          {failed ? <span role="alert" className="text-[#8c2f24]">{words.notices.failed}</span> : words.shell.typedStays}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
