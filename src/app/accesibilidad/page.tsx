import { PrivacyPage, accessibilityMetadata, privacyViewport } from "@/components/privacy-page";
import { accessibilityWords } from "@/lib/accessibility-words";

export const viewport = privacyViewport;
export const metadata = accessibilityMetadata("es");

export default function Accesibilidad() {
  return <PrivacyPage language="es" book={accessibilityWords} />;
}
