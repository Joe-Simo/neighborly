"use client";
import { Button } from "@/components/ui/button";
import { useEntryLanguage } from "@/components/live-auth-words";
import type { Language } from "@/lib/words";

export function TryAgain({ said }: { said: { language: Language; tryAgain: string; tab: string }[] }) {
  const [language] = useEntryLanguage();
  return (
    <>
      <title>{said.find((words) => words.language === language)?.tab}</title>
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
