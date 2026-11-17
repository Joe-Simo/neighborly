import { PrivacyPage, privacyMetadata } from "@/components/privacy-page";

export const metadata = privacyMetadata("en");

export default function Privacy() {
  return <PrivacyPage language="en" />;
}
