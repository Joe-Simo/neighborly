import type { Words } from "./en";
import type { Terms, WordSet } from "./sets";

const terms: Record<WordSet, Terms> = {
  general: {
    group: "gwoup",
    member: "volontè",
    members: "volontè",
    neighbor: "vwazen",
    neighbors: "vwazen",
    visit: "vizit",
    visits: "vizit",
  },
  vincentian: {
    group: "konferans",
    member: "Vensansyen",
    members: "Vensansyen",
    neighbor: "vwazen",
    neighbors: "vwazen",
    visit: "Vizit Lakay",
    visits: "Vizit Lakay",
  },
};

/** Haitian Creole. Written without a native speaker's review; one is still owed. */
export function ht(set: WordSet): Words {
  const t = terms[set];
  return {
    locale: "ht",
    // Browsers have no Creole calendar words. French ones are the closest a reader will know.
    dates: "fr-HT",
    terms: t,
    menu: {
      week: "Semèn sa a",
      team: "Ekip",
      people: "Moun",
      commitments: "Angajman",
      mine: "Angajman mwen",
      "time-off": "Jou konje",
      tasks: "Travay ak reyinyon",
    },
    shell: {
      menu: "Meni",
      menuTitle: "Espas ou",
      menuLabel: "Meni espas ou",
      menuCurrent: (section) => `Meni espas ou, ou nan: ${section}`,
      allSections: "Tout seksyon yo",
      workspace: "Espas ou",
      current: "Isit la",
      skip: "Ale nan espas ou",
      signOut: "Soti",
      language: "Lang",
      member: "Manm",
      team: "Ekip",
      limited: "Kèk lis montre sèlman yon pati. Sèvi ak Chaje plis nan seksyon an pou wè rès la.",
    },
    headings: {
      week: {
        title: "Bon travay, semèn sa a.",
        deck: "Angajman ou, plan tout moun ak sa pou ou konnen.",
      },
      team: {
        title: "Yon plas nan ekip la.",
        deck: "Gen plas pou chak moun isit la, menm lè plan yo chanje.",
      },
      people: {
        title: "Moun, ansanm.",
        deck: "Kominote ou ak ekip li rann posib yo.",
      },
      commitments: {
        title: "Angajman ki klè.",
        deck: "Gade sa ki kouvri, sa ki lib ak sa k ap tann repons.",
      },
      mine: {
        title: "Pati pa ou.",
        deck: "Sa ou aksepte, ak sa ou bezwen pou ou pare.",
      },
      "time-off": {
        title: "Tan pou lavi.",
        deck: "Fè ekip ou konnen lè ou pa la.",
      },
      tasks: {
        title: "Ti bagay yo konte.",
        deck: "Travay ak reyinyon tout moun, chak ak pwochen etap li.",
      },
    },
    actions: {
      team: "Kreye yon ekip",
      invite: "Envite yon moun",
      commitment: "Ajoute yon angajman",
      timeOff: "Planifye jou konje",
      task: "Ajoute yon travay",
      meeting: "Planifye yon reyinyon",
      announcement: "Pataje yon anons",
    },
    week: {
      comingUp: "Sa k ap vini",
      nextSevenDays: "7 jou k ap vini yo",
      choiceAboveTitle: "Pwochen chwa ou anlè a.",
      choiceAboveDetail:
        "Reponn envitasyon ou lè ou pare. Lòt angajman ou yo ap parèt isit la.",
      quietTitle: "Yon ti souf.",
      quietDetail:
        "Pa gen angajman nan sèt jou k ap vini yo. Dat ki pi lwen yo nan Angajman.",
      fromGroup: `Nan ${t.group} ou`,
      noAnnouncementsTitle: "Poko gen anons.",
      noAnnouncementsDetail: "Nouvèl kowòdonatè ou yo ap rete isit la.",
    },
    mine: {
      accepted: "Angajman ou aksepte",
      emptyTitle: "Poko gen anyen nan kalandriye ou.",
      emptyDetail:
        "Angajman ou aksepte yo ap parèt isit la ak tout sa ou bezwen pou ou pare.",
    },
    commitments: {
      emptyTitle: "Pa gen angajman k ap vini.",
      emptyDetail:
        "Nouvo angajman yo ap parèt isit la ak dat, moun ak preparasyon yo.",
      placeOpen: "Gen yon plas ki lib",
      status: { accepted: "aksepte", open: "lib", cancelled: "anile" },
      viewPreparation: "Gade preparasyon an",
      viewCommitment: "Gade angajman an",
      details: "Detay",
    },
    requests: {
      title: "Chwa pa ou",
      awaiting: (count) => `${count} ap tann repons ou`,
      fallbackTitle: "Demann pou ranplase yon moun",
      unavailable: "Detay angajman an pa disponib",
      accept: "Aksepte",
      decline: "Mwen pa kapab",
      accepted: "Angajman aksepte. Plan ou ajou.",
      declined: "Demann refize. Yo pa ba ou okenn angajman.",
    },
    detail: {
      cancelled:
        "Angajman sa a anile. Istwa li rete, epi yo pa tann pèsonn.",
      when: "Kilè",
      where: "Ki kote",
      whereUnknown: "Kote a poko konfime",
      person: "Moun",
      coordinator: "Kowòdonatè",
      unassigned: "Pèsonn poko",
      fallbackTitle: "Angajman",
      readyTitle: "Pou ou pare",
      noPreparation:
        "Poko gen preparasyon. Mande kowòdonatè ou sa ou bezwen.",
      change: "Chanje angajman sa a",
      changeTitle: "Chanje yon angajman",
      released: "Angajman an lage. Lòt dat ou yo pa chanje.",
    },
    timeOff: {
      note: "Jou konje pa retire ou nan ekip ou yo. Angajman ou genyen deja yo chanje apa, pou tout moun konnen sa ki kouvri.",
      remove: "Retire",
      removed: "Jou konje retire.",
      emptyTitle: "Ou pa planifye jou konje.",
      emptyDetail:
        "Ajoute dat ou p ap disponib yo. Plas ou nan ekip la rete menm jan.",
      coverTitle: "Demann pou ranplase",
      coverDeck:
        "Chwazi si kowòdonatè yo ka mande ou ranplase yon moun nan yon angajman ki lib. Chak demann bezwen wi pa ou.",
      coverStop: "Sispann resevwa demann",
      coverStart: "Resevwa demann",
      availableTitle: "Kilè ou ka ede",
      availableDeck:
        "Ofri dat ou ka ranplase yon moun. Disponib pa vle di ou aksepte yon angajman.",
      firstAvailable: "Premye jou disponib",
      lastAvailable: "Dènye jou disponib",
      addAvailable: "Ajoute dat disponib",
    },
    timeOffForm: {
      firstDay: "Premye jou",
      lastDay: "Dènye jou",
      noteLabel: "Nòt (si ou vle)",
      noteHelp: "Ekri sèlman sa kowòdonatè ou yo bezwen konnen.",
      orderError: "Dènye jou a dwe menm jou ak premye a oswa apre li.",
      review: "Gade angajman sa touche yo",
      checking: "N ap gade angajman ou yo…",
      affected: (count) =>
        count === 0 ? "Sa pa touche okenn angajman" : `Sa touche ${count} angajman`,
      explain:
        "Lè ou konfime, se sèlman angajman sa yo k ap lage epi jou konje ou yo ap anrejistre. Ekip ou yo ak lòt dat yo rete menm jan.",
      back: "Tounen",
      saving: "N ap anrejistre…",
      confirm: "Konfime jou konje",
      failed:
        "Nou pa t kapab konfime dat sa yo. Angajman ou yo ka chanje. Tounen pou gade lis la jan li ye kounye a.",
      saved: "Jou konje anrejistre. Se sèlman angajman ou te gade yo ki lage.",
    },
    notices: {
      saved: "Anrejistre.",
      updated: "Mete ajou.",
      failed: "Chanjman an pa t anrejistre. Tanpri eseye ankò.",
    },
    assistant: {
      title: "Bouyon pou ou",
      waiting: (count) => `${count} ap tann wi pa ou`,
      origin:
        "Asistan an ekri sa apati nòt apèl la. Anyen pa anrejistre toutotan ou pa apwouve li.",
      checked: "Asistan an konpare chak detay ak nòt la.",
      review: "Asistan an pa t kapab verifye sa. Tanpri li chak detay ak nòt la.",
      blank: "Li rete vid paske nòt la pa di sa klèman.",
      approve: "Apwouve demann lan",
      change: "Chanje",
      discard: "Jete",
    },
  };
}
