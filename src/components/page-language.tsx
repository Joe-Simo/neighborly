"use client";

import { useLayoutEffect } from "react";
import { entryLanguageNow, useEntryLanguage } from "@/components/live-auth-words";

/** The door's language on the page itself, set before the first paint however the app was reached. */
export function PageLanguage() {
  const [language] = useEntryLanguage();
  useLayoutEffect(() => {
    // The device's own answer, not `language`: while a fresh load wakes, `language` is still the server's English.
    document.documentElement.lang = entryLanguageNow();
    return () => {
      document.documentElement.lang = "en";
    };
  }, [language]);
  return null;
}
