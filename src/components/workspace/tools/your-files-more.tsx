"use client";

import ReferralAgencies from "@/components/workspace/tools/referral-agencies";
import UploadedFiles from "@/components/workspace/tools/uploaded-files";

/**
 * The agencies a group refers to and the conference's own files: one chunk, fetched once the room opens for
 * someone the server lets open neighbor records (tools.tsx asks), so the room's first load carries none of it.
 */
export default function YourFilesMore() {
  return (
    <>
      <ReferralAgencies />
      <UploadedFiles />
    </>
  );
}
