import { fetchedCode } from "@/components/workspace/fetched-code";

// A sheet's form is its own file: it is not run with the room's frame (where it held a phone's first frame of the
// workspace longer), only fetched with the rooms ahead once the page is idle, or when its sheet is first opened. A sheet
// opens in a transition (live-dialog.tsx), so a form still on its way keeps only the press waiting, never the room.
const timeOff = fetchedCode(() => import("@/components/workspace/volunteer/time-off-form").then((code) => code.LiveTimeOffForm));
const create = fetchedCode(() => import("@/components/workspace/volunteer/create-form").then((code) => code.LiveCreateForm));
const detail = fetchedCode(() => import("@/components/workspace/volunteer/commitment-detail").then((code) => code.CommitmentDetail));
const editor = fetchedCode(() => import("@/components/workspace/volunteer/commitment-editor").then((code) => code.LiveCommitmentEditor));

export const LiveTimeOffForm = timeOff.Code;
export const LiveCreateForm = create.Code;
export const CommitmentDetail = detail.Code;
export const LiveCommitmentEditor = editor.Code;

export const fetchSheetsAhead = () => Promise.all([timeOff.fetch(), create.fetch(), detail.fetch(), editor.fetch()]);
