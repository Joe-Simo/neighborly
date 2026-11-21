import { useEffect, useState } from "react";

type Forms = Pick<typeof import("@/components/workspace/help-line/forms"), "CloseForm" | "DecideForm" | "NeighborForm" | "RemoveForm" | "RequestForm" | "takingBack">;
let formsHere: Forms | undefined;
let formsComing: Promise<Forms> | undefined;
/** The neighbors' sheets' forms, fetched once; a fetch that fails is forgotten, so the next press asks again. */
function loadForms() {
  formsComing ??= import("@/components/workspace/help-line/forms").then(
    ({ CloseForm, DecideForm, NeighborForm, RemoveForm, RequestForm, takingBack }) =>
      (formsHere = { CloseForm, DecideForm, NeighborForm, RemoveForm, RequestForm, takingBack }),
    (error: unknown) => {
      formsComing = undefined;
      throw error;
    },
  );
  return formsComing;
}

/**
 * The forms, fetched when the person first presses in the room (never while it is put in or switched to, as on the
 * help line), or at once when a sheet is asked for (`now`). A sheet is drawn when its form is here, whole.
 */
export function useFormsLater(now: boolean) {
  const [forms, setForms] = useState(formsHere);
  useEffect(() => {
    if (forms) return;
    const take = () => void loadForms().then(setForms, () => {});
    if (now) return take();
    // A press on the menu or the tabs is a way out of the room: nothing is fetched under the switch it starts.
    const press = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest("header, nav, .live-mobile-menu")) take();
    };
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("keydown", press, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("keydown", press);
    };
  }, [forms, now]);
  return forms;
}
