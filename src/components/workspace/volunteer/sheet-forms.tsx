import { use, type ComponentType } from "react";

// The three forms the shell opens in a sheet carry the date picker and the calendar arithmetic, which no room needs to
// draw its first frame. They are fetched with the rooms ahead, once the first room is in and the page is idle, so a
// sheet opened after that draws its form on its first frame, as before; one opened sooner waits for it in the sheet.
function fetchedForm<P extends object>(load: () => Promise<ComponentType<P>>) {
  let asked: Promise<ComponentType<P>> | undefined;
  const fetch = () => {
    if (!asked) {
      const fetched = load().then(
        (code) => {
          // Marked as React marks a promise it has read, so `use` answers at once from then on and a sheet opened
          // after the code is here draws its form on its first frame, without waiting a turn.
          Object.assign(fetched, { status: "fulfilled", value: code });
          return code;
        },
        (fault: unknown) => {
          // Forgotten, so the next opening of the sheet really fetches again.
          if (asked === fetched) asked = undefined;
          throw fault;
        },
      );
      asked = fetched;
    }
    return asked;
  };
  function SheetForm(props: P) {
    const Code = use(fetch());
    return <Code {...props} />;
  }
  return { fetch, Form: SheetForm };
}

export const sheetForms = {
  create: fetchedForm(() => import("@/components/workspace/volunteer/create-form").then((code) => code.LiveCreateForm)),
  timeOff: fetchedForm(() => import("@/components/workspace/volunteer/time-off-form").then((code) => code.LiveTimeOffForm)),
  editor: fetchedForm(() => import("@/components/workspace/volunteer/commitment-editor").then((code) => code.LiveCommitmentEditor)),
};

/** Every form not yet fetched. Called with the rooms ahead; a form that does not come is fetched when it is opened. */
export function fetchFormsAhead() {
  for (const form of Object.values(sheetForms)) void form.fetch().catch(() => {});
}
