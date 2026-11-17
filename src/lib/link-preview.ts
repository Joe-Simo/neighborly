import type { Metadata } from "next";

/**
 * What a shared link shows, on every public page. A page that sets its own title and description for the preview
 * replaces the whole block, so each takes the picture and the site's name from here and none goes out without them.
 * The picture is cut from the home page's closing painting below the two faces, with the name inside its middle
 * square, so the wide crop and a chat app's square crop both show the name whole and neither crosses a face.
 */
export const linkPreview = {
  type: "website",
  siteName: "Kind Helps",
  images: [{ url: "/assets/link-preview.jpg", width: 1200, height: 630, alt: "Two hands in layered paper relief, one passing a small card to the open palm of the other, under the words kind helps. Good work, together." }],
} satisfies Metadata["openGraph"];
