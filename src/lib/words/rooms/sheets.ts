import type { Terms } from "../sets";

/**
 * The shell's own sheets: an invitation made, a commitment edited, a yes-or-no, a date given back.
 * Every sentence is written whole in each language; nothing is joined from pieces on the screen.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- every room's table is given the place; these sheets do not name it
export const en = (t: Terms, place: string) => ({
  invite: {
    deck: `They’ll choose to join your ${t.group}.`,
    queued: "Invitation made. The email is queued but not yet delivered.",
    noEmail: "Invitation made. No email was sent.",
    linkQueued: "Invitation made and the email queued. Share this private link with them:",
    linkNoEmail: "Invitation made. No email was sent. Share this private link with them:",
    linkLabel: "Private invitation link",
    dismiss: "Dismiss",
  },
  saved: "Saved.",
  updated: "Updated.",
  goBack: "Go back",
  edit: {
    title: "Edit commitment",
    deck: (zone: string) => `Times are ${zone}. You’ll review the changes before saving.`,
    role: "Role or title",
    starts: "Starts",
    ends: "Ends",
    where: "Where",
    preparation: "Preparation",
    review: "Review changes",
    releases:
      "Changing the date, time, role, place or preparation frees whoever accepted and withdraws open requests for cover. Someone must accept it again. Saving with nothing changed keeps the yes.",
    back: "Back",
    confirm: "Confirm changes",
    saving: "Saving…",
    done: "Commitment updated. A real change needs a new yes.",
  },
  /** The owner's desk under a meeting: who replied, and sending its invitations again. */
  meeting: {
    again: "Prepare the invitations again",
    againSaid: "Preparing the invitations again.",
    show: "Show replies",
    hide: "Hide replies",
    none: "No replies yet.",
    more: "Load more replies",
    loading: "Loading replies…",
    replied: { accepted: "Accepted", declined: "Declined" },
  },
  release: {
    body: "This releases this date only. Your other commitments and your place on the team stay the same. The date will need cover.",
    keep: "Keep commitment",
    confirm: "Confirm change",
  },
});

export const es = (t: Terms, place: string): ReturnType<typeof en> => {
  void place;
  // The group's word has its own gender: "tu conferencia" needs none, so the sentence is built around "tu".
  return {
    invite: {
      deck: `Esa persona decidirá si se une a tu ${t.group}.`,
      queued: "Invitación creada. El correo está en cola y aún no sale.",
      noEmail: "Invitación creada. No se envió ningún correo.",
      linkQueued: "Invitación creada y correo en cola. Comparte este enlace privado con esa persona:",
      linkNoEmail: "Invitación creada. No se envió ningún correo. Comparte este enlace privado con esa persona:",
      linkLabel: "Enlace privado de la invitación",
      dismiss: "Cerrar",
    },
    saved: "Guardado.",
    updated: "Actualizado.",
    goBack: "Volver",
    edit: {
      title: "Cambiar el compromiso",
      deck: (zone) => `Horario: ${zone}. Revisarás los cambios antes de guardar.`,
      role: "Rol o título",
      starts: "Empieza",
      ends: "Termina",
      where: "Dónde",
      preparation: "Preparación",
      review: "Revisar los cambios",
      releases:
        "Cambiar la fecha, la hora, el rol, el lugar o la preparación libera a quien había aceptado y retira las peticiones abiertas para cubrirlo. Alguien tiene que aceptarlo de nuevo. Si guardas sin cambiar nada, el sí se mantiene.",
      back: "Atrás",
      confirm: "Confirmar los cambios",
      saving: "Guardando…",
      done: "Compromiso actualizado. Un cambio de fondo necesita un nuevo sí.",
    },
    meeting: {
      again: "Preparar las invitaciones otra vez",
      againSaid: "Se están preparando las invitaciones otra vez.",
      show: "Ver respuestas",
      hide: "Ocultar respuestas",
      none: "Aún no hay respuestas.",
      more: "Cargar más respuestas",
      loading: "Cargando respuestas…",
      replied: { accepted: "Aceptó", declined: "No puede" },
    },
    release: {
      body: "Esto libera solo esta fecha. Tus otros compromisos y tu lugar en el equipo siguen igual. Habrá que buscar quién cubra esa fecha.",
      keep: "Conservar el compromiso",
      confirm: "Confirmar el cambio",
    },
  };
};
