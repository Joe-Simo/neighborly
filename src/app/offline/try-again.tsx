"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useEntryLanguage } from "@/components/live-auth-words";
import type { Language } from "@/lib/words";

export function TryAgain({ said }: { said: { language: Language; tryAgain: string; tab: string }[] }) {
  const [language] = useEntryLanguage();
  // The page is sent with one title, in English (page.tsx). Here it is said in the reader's language.
  const tab = said.find((words) => words.language === language)?.tab;
  useEffect(() => {
    if (tab) document.title = tab;
  }, [tab]);
  return (
    <>
      <Button onClick={() => window.location.reload()} style={{ marginTop: 24 }}>
        {said.map(({ language, tryAgain }) => (
          <span key={language} lang={language}>
            {tryAgain}
          </span>
        ))}
      </Button>
    </>
  );
}
