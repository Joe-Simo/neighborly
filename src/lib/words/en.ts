import type { Language, Terms, WordSet } from "./sets";

const terms: Record<WordSet, Terms> = {
  general: {
    group: "group",
    member: "volunteer",
    members: "volunteers",
    neighbor: "neighbor",
    neighbors: "neighbors",
    visit: "visit",
    visits: "visits",
  },
  vincentian: {
    group: "conference",
    member: "Vincentian",
    members: "Vincentians",
    neighbor: "neighbor",
    neighbors: "neighbors",
    visit: "Home Visit",
    visits: "Home Visits",
  },
};

/** English is the source: its text is what the screens show today, word for word. */
export function en(set: WordSet) {
  const t = terms[set];
  return {
    locale: "en" as Language,
    terms: t,
    menu: {
      week: "This week",
      team: "Teams",
      people: "People",
      commitments: "Commitments",
      mine: "My commitments",
      "time-off": "Time off",
      tasks: "Tasks & meetings",
      "help-line": "Help line",
      neighbors: "Neighbors",
      treasury: "Treasury",
      reports: "Reports",
      visits: "Home visits",
    },
    shell: {
      menu: "Menu",
      menuTitle: "Your workspace",
      menuLabel: "Workspace menu",
      menuCurrent: (section: string) => `Workspace menu, current section: ${section}`,
      allSections: "All workspace sections",
      workspace: "Workspace",
      current: "Current",
      skip: "Skip to your workspace",
      signOut: "Sign out",
      language: "Language",
      typedStays: "Words people typed stay as they wrote them.",
      member: "Member",
      team: "Team",
      limited: "Some overview lists show a limited set of records. Use Load more in the matching section to see additional records.",
    },
    headings: {
      week: {
        title: "Good work, this week.",
        deck: "Your commitments, shared plans and the things to know.",
      },
      mine: {
        title: "Your part in it.",
        deck: "What you’ve accepted, with the preparation to feel ready.",
      },
      "time-off": {
        title: "Room for life.",
        deck: "Keep your team informed while you take time away.",
      },
    },
    actions: {
      timeOff: "Plan time off",
    },
    week: {
      comingUp: "Coming up",
      nextSevenDays: "Next 7 days",
      choiceAboveTitle: "Your next choice is above.",
      choiceAboveDetail:
        "Reply to your invitation when you’re ready. Other upcoming commitments will appear here.",
      quietTitle: "A little breathing room.",
      quietDetail:
        "No commitments are scheduled in the next seven days. Later dates are in Commitments.",
      fromGroup: `From your ${t.group}`,
      noAnnouncementsTitle: "No announcements yet.",
      noAnnouncementsDetail: "Updates from your coordinators will be kept here.",
    },
    mine: {
      accepted: "Accepted commitments",
      emptyTitle: "Nothing on your calendar yet.",
      emptyDetail:
        "Commitments you accept will appear here with everything you need to prepare.",
    },
    commitments: {
      emptyTitle: "No upcoming commitments.",
      emptyDetail:
        "New commitments will appear here with their date, person and preparation.",
      placeOpen: "A place is open",
      status: { accepted: "accepted", open: "open", cancelled: "cancelled" },
      viewPreparation: "View preparation",
      viewCommitment: "View commitment",
      details: "Details",
    },
    requests: {
      title: "Your choice",
      awaiting: (count: number) => `${count} awaiting your reply`,
      fallbackTitle: "Cover request",
      unavailable: "Commitment details unavailable",
      accept: "Accept",
      decline: "Decline",
      accepted: "Commitment accepted. Your plan is updated.",
      declined: "Request declined. No commitment has been assigned.",
    },
    detail: {
      cancelled:
        "This commitment is cancelled. Its history is retained, and no one is expected to serve.",
      when: "When",
      where: "Where",
      whereUnknown: "Location to be confirmed",
      person: "Person",
      coordinator: "Coordinator",
      unassigned: "Unassigned",
      fallbackTitle: "Commitment",
      readyTitle: "Ready to take part",
      noPreparation:
        "No preparation has been added yet. Ask your coordinator for what you need.",
      change: "Change this commitment",
      changeTitle: "Change one commitment",
      released: "Commitment released. Your other dates are unchanged.",
    },
    timeOff: {
      note: "Time off does not remove you from your teams. Existing commitments need a separate change so everyone knows what is covered.",
      remove: "Remove",
      removed: "Time off removed.",
      emptyTitle: "No time away planned.",
      emptyDetail:
        "Add dates when you won’t be available. Your place on the team stays the same.",
      coverTitle: "Cover requests",
      coverDeck:
        "Choose whether coordinators may ask you to cover an open commitment. Every request still needs your acceptance.",
      coverStop: "Stop receiving cover requests",
      coverStart: "Receive cover requests",
      availableTitle: "When you can help",
      availableDeck:
        "Volunteer dates when you’re available for cover. Availability is not an accepted commitment.",
      firstAvailable: "First available day",
      lastAvailable: "Last available day",
      addAvailable: "Add available dates",
    },
    timeOffForm: {
      firstDay: "First day",
      lastDay: "Last day",
      noteLabel: "Note (optional)",
      noteHelp: "Only include what your coordinators need to know.",
      orderError: "The last day must be on or after the first day.",
      review: "Review affected commitments",
      checking: "Checking your commitments…",
      affected: (count: number) =>
        count === 0
          ? "No commitments affected"
          : `${count} ${count === 1 ? "commitment" : "commitments"} affected`,
      explain:
        "Confirming will release only these commitments and record your time off. Team memberships and other dates stay the same.",
      back: "Back",
      saving: "Saving…",
      confirm: "Confirm time off",
      failed:
        "We couldn’t confirm these dates. Your commitments may have changed. Go back to review the current list.",
      saved: "Time off saved. Only the reviewed commitments were released.",
    },
    notices: {
      saved: "Saved.",
      updated: "Updated.",
      failed: "That change couldn’t be saved. Please try again.",
    },
    visits: {
      title: "Home visits",
      count: (count: number) => `${count} ${count === 1 ? "visit" : "visits"}, always with a partner`,
      notSaved: "Your answer was not saved. Try again.",
      on: (street: string) => `A visit on ${street}`,
      nearby: "a street nearby",
      partner: (name: string) => `With ${name}. Your coordinator has the visit sheet.`,
      go: "I’ll go",
      cannot: "I can’t go",
      going: "You’re going",
      notGoing: "You can’t go",
      cannotAfterAll: "I can’t go after all",
      canAfterAll: "I can go after all",
    },
    /** The check before the yearly report. Each line points a person to one record; nothing is changed for them. */
    yearCheck: {
      title: "Before you send it",
      count: (count: number) => `${count} ${count === 1 ? "record" : "records"} to look at`,
      clear: "Everything adds up.",
      approvedNotPaid: "Approved more than a month ago, and no payment is recorded.",
      paidNoPayment: "Marked paid, and no payment is in the ledger.",
      visitNoHours: "A finished visit with no hours written down.",
      noteSaysPaid: "The note says this was paid, and no payment is recorded.",
      visitNotMarked: "The note says this visit happened, and it is not marked done.",
      byRule: "Found by counting.",
      byAssistant: "The assistant read the note. Please read it yourself.",
      open: "Open the record",
    },
    /** Why the assistant put a call first. A person can always move it. */
    urgent: {
      label: "Call first",
      origin: "Put first by the assistant from the note. You can move it.",
      shutoff: (day: number) => (day ? `Shut-off on the ${day}${["th", "st", "nd", "rd"][day % 100 > 10 && day % 100 < 14 ? 0 : Math.min(day % 10, 4) % 4]}` : "Shut-off notice"),
      eviction: (day: number) => (day ? `Eviction on the ${day}${["th", "st", "nd", "rd"][day % 100 > 10 && day % 100 < 14 ? 0 : Math.min(day % 10, 4) % 4]}` : "Eviction notice"),
      noFood: "No food today",
      child: "Children at home",
      elder: "Elderly or living alone",
      medical: "A medical need",
      notUrgent: "Not urgent",
    },
    /** What a person reads beside anything the assistant drafted. */
    assistant: {
      title: "Drafted for you",
      waiting: (count: number) => `${count} waiting for your yes`,
      origin: "Written by the assistant from the call note. Nothing is saved until you approve it.",
      checked: "The assistant checked each detail against the note.",
      review: "The assistant could not check this. Please read each detail against the note.",
      blank: "Left blank because the note does not say it plainly.",
      approve: "Approve request",
      change: "Change",
      discard: "Discard",
    },
  };
}

export type Words = ReturnType<typeof en>;
