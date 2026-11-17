import { PrivacyPage, privacyMetadata } from "@/components/privacy-page";

export const metadata = privacyMetadata("es");

/** The privacy page in Spanish, at its own address: the sign-in sheet's "Privacidad" opens it. */
export default function Privacidad() {
  return <PrivacyPage language="es" />;
}
