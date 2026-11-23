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
    linkQueued: "Share this private link with them:",
    linkNoEmail: "Share this private link with them:",
    linkLabel: "Private invitation link",
    dismiss: "Dismiss",
  },
  /** Each done line names what was done, so it says enough when it is heard alone. */
  done: {
    announcementShared: (title: string) => `Announcement shared. ${title}`,
    teamCreated: (name: string) => `Team created. ${name}`,
    commitmentAdded: (title: string) => `Commitment added. ${title}`,
    meetingPlanned: (title: string) => `Meeting planned. ${title}`,
    commitmentCanceled: (title: string) => `Commitment canceled. ${title}`,
    markedReady: (name: string) => `${name} is marked ready to serve.`,
    markedNotReady: (name: string) => `${name} is marked not ready.`,
    accessRemoved: (name: string) => `${name} can no longer sign in.`,
    accessRestored: (name: string) => `${name} can sign in again.`,
    inviteWithdrawn: (email: string) => `Invitation to ${email} withdrawn.`,
  },
  goBack: "Go back",
  edit: {
    title: "Edit commitment",
    deck: (zone: string) => `Times are ${zone}. You’ll review the changes before saving.`,
    role: "Title",
    starts: "Starts",
    ends: "Ends",
    where: "Where to meet",
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
      linkQueued: "Comparte este enlace privado con esa persona:",
      linkNoEmail: "Comparte este enlace privado con esa persona:",
      linkLabel: "Enlace privado de la invitación",
      dismiss: "Cerrar",
    },
    // A named person's gender is never marked: each line is said about the act or with "ya puede".
    done: {
      announcementShared: (title) => `Aviso compartido. ${title}`,
      teamCreated: (name) => `Equipo creado. ${name}`,
      commitmentAdded: (title) => `Compromiso agregado. ${title}`,
      meetingPlanned: (title) => `Reunión planeada. ${title}`,
      commitmentCanceled: (title) => `Compromiso cancelado. ${title}`,
      markedReady: (name) => `${name} ya puede servir.`,
      markedNotReady: (name) => `Se marcó que ${name} aún no puede servir.`,
      accessRemoved: (name) => `${name} ya no puede iniciar sesión.`,
      accessRestored: (name) => `${name} ya puede iniciar sesión de nuevo.`,
      inviteWithdrawn: (email) => `Se anuló la invitación a ${email}.`,
    },
    goBack: "Volver",
    edit: {
      title: "Cambiar el compromiso",
      deck: (zone) => `Horario: ${zone}. Revisarás los cambios antes de guardar.`,
      role: "Título",
      starts: "Empieza",
      ends: "Termina",
      where: "Dónde reunirse",
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
      none: "Todavía no hay respuestas.",
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
