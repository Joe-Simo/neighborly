import { PrivacyPage, privacyMetadata, privacyViewport } from "@/components/privacy-page";

export const viewport = privacyViewport;
export const metadata = privacyMetadata("en");

export default function Privacy() {
  return <PrivacyPage language="en" />;
}
