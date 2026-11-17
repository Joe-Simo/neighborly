"use client";

import { useLayoutEffect } from "react";
import { entryLanguageNow, tabInReadersLanguage, useEntryLanguage } from "@/components/live-auth-words";

/** The door's language on the page itself and on the workspace's tab, set before the first paint however the app was reached. */
export function PageLanguage() {
  const [language] = useEntryLanguage();
  useLayoutEffect(() => {
    // The device's own answer, not `language`: while a fresh load wakes, `language` is still the server's English.
    document.documentElement.lang = entryLanguageNow();
    document.title = tabInReadersLanguage(document.title);
    return () => {
      document.documentElement.lang = "en";
    };
  }, [language]);
  return null;
}
