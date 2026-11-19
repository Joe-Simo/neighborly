import type { Metadata } from "next";

/**
 * What a shared link shows, on every public page. A page that sets its own title and description for the preview
 * replaces the whole block, so each takes the picture and the site's name from here and none goes out without them.
 * The picture is cut from the home page's closing painting below the two faces, with the name inside its middle
 * square, so the wide crop and a chat app's square crop both show the name whole and neither crosses a face.
 */
const picture = { url: "/assets/link-card.jpg", width: 1200, height: 630 };
const described = {
  en: "Two hands in layered paper relief: one reaches toward a small card resting on the open palm of the other, under the words kind helps.",
  es: "Dos manos en relieve de papel: una se acerca a una tarjeta pequeña que descansa en la palma abierta de la otra, bajo las palabras kind helps.",
};
/** A preview names its language the way the apps that read it expect: language and region. */
const locales = { en: "en_US", es: "es_LA" };
export const linkPreviewIn = (language: keyof typeof described) => ({
  type: "website",
  siteName: "Kind Helps",
  locale: locales[language],
  alternateLocale: locales[language === "en" ? "es" : "en"],
  images: [{ ...picture, alt: described[language] }],
}) satisfies Metadata["openGraph"];
export const linkPreview = linkPreviewIn("en");
/** The same picture for apps that read the Twitter card, described in the page's own language. */
export const linkCardIn = (language: keyof typeof described) => ({
  card: "summary_large_image",
  images: [{ url: "/assets/link-card.jpg", alt: described[language] }],
}) satisfies Metadata["twitter"];
