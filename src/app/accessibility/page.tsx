import { PrivacyPage, accessibilityMetadata, privacyViewport } from "@/components/privacy-page";
import { accessibilityWords } from "@/lib/accessibility-words";

export const viewport = privacyViewport;
export const metadata = accessibilityMetadata("en");

export default function Accessibility() {
  return <PrivacyPage language="en" book={accessibilityWords} />;
}
