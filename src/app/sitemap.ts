import type { MetadataRoute } from "next";

const site = "https://kindhelps.com";
/** Each page of words in English and Spanish; each names the other, so a search engine shows the reader's own. */
const pairs = [
  { en: "/help", es: "/ayuda", priority: .8 },
  { en: "/privacy", es: "/privacidad", priority: .3 },
  { en: "/accessibility", es: "/accesibilidad", priority: .3 },
  { en: "/about/a-week", es: "/sobre/una-semana", priority: .5 },
  { en: "/about/how-we-made-it", es: "/sobre/como-lo-hicimos", priority: .4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    ...pairs.flatMap(({ en, es, priority }) => {
      const languages = { en: `${site}${en}`, es: `${site}${es}`, "x-default": `${site}${en}` };
      return [en, es].map((path) => ({ url: `${site}${path}`, changeFrequency: "monthly" as const, priority, alternates: { languages } }));
    }),
  ];
}
