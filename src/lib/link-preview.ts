import type { Metadata } from "next";

/**
 * What a shared link shows, on every public page. A page that sets its own title and description for the preview
 * replaces the whole block, so each takes the picture and the site's name from here and none goes out without them.
 * The picture is cut from the home page's closing painting below the two faces, with the name inside its middle
 * square, so the wide crop and a chat app's square crop both show the name whole and neither crosses a face.
 */
const picture = { url: "/assets/link-card.jpg", width: 1200, height: 630 };
const described = {
  en: "Two hands in layered paper relief, one passing a small card to the open palm of the other, under the words kind helps.",
  es: "Dos manos en relieve de papel: una le pasa una tarjeta pequeña a la palma abierta de la otra, bajo las palabras kind helps.",
};
/** A preview names its language the way the apps that read it expect: language and region. */
const locales = { en: "en_US", es: "es_LA" };
export const linkPreviewIn = (language: keyof typeof described) => ({
  type: "website",
  siteName: "Kind Helps",
  locale: locales[language],
  images: [{ ...picture, alt: described[language] }],
}) satisfies Metadata["openGraph"];
export const linkPreview = linkPreviewIn("en");
