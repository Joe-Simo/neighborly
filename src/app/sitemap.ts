import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://kindhelps.com/", changeFrequency: "weekly", priority: 1 },
    { url: "https://kindhelps.com/privacy", changeFrequency: "monthly", priority: .3 },
    { url: "https://kindhelps.com/privacidad", changeFrequency: "monthly", priority: .3 },
    { url: "https://kindhelps.com/about/how-we-made-it", changeFrequency: "monthly", priority: .4 },
    { url: "https://kindhelps.com/sobre/como-lo-hicimos", changeFrequency: "monthly", priority: .4 },
  ];
}
