"use client";

import { useLayoutEffect } from "react";
import { sayReadersLanguage } from "@/lib/first-language";
import type { Language } from "@/lib/words";

/**
 * For a page outside the app that is not in English: the page's root says its language before the first paint,
 * and its tab is named in it. With `page`, that language; without, the reader's own (a page that carries both
 * languages, which a fresh load has already answered by the script written ahead of its words). With `abouts`, the
 * page's description is said in that language too.
 */
export function ReaderLanguage({ page, tabs, abouts }: { page?: Language; tabs?: Record<Language, string>; abouts?: Record<Language, string> }) {
  useLayoutEffect(() => {
    const root = document.documentElement, title = document.title;
    if (page) root.lang = page; else sayReadersLanguage();
    const tab = tabs?.[root.lang as Language];
    if (tab) document.title = tab;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]'), about = meta?.content;
    const said = abouts?.[root.lang as Language];
    if (meta && said) meta.content = said;
    return () => {
      root.lang = "en";
      if (tab) document.title = title;
      if (meta && said && about !== undefined) meta.content = about;
    };
  }, [page, tabs, abouts]);
  return null;
}
