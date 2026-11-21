import { measured as m } from "../jev-set";
import { refusals } from "../refusals";
import { nextStep, notFound, sayLikeEnglish, serverRefusalPatternsEs, serverRefusalsEs, serverRefusalsPlain } from "../refusals-es";
import * as helpLineWords from "./rooms/help-line";
import * as helpLineFormsWords from "./rooms/help-line-forms";
import * as neighborsWords from "./rooms/neighbors";
import * as visitsRoomWords from "./rooms/visits";
import * as treasuryWords from "./rooms/treasury";
import * as reportsWords from "./rooms/reports";
import * as toolsWords from "./rooms/tools";
import * as peopleRoomWords from "./rooms/people";
import * as sheetsWords from "./rooms/sheets";
import * as firstDaysWords from "./rooms/first-days";
import type { Language, Terms, WordSet } from "./sets";
import { counter } from "./numbers";
const enN = counter("en");

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
    visit: "home visit",
    visits: "home visits",
  },
};

/** English is the source: its text is what the screens show today, word for word. */
export function en(set: WordSet) {
  const t = terms[set];
  // What a person calls the whole place they signed in to: a Vincentian's is their conference.
  const place = set === "vincentian" ? "conference" : "workspace";
  const Place = place.charAt(0).toUpperCase() + place.slice(1);
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
      tools: "Your files",
    },
    shell: {
      menu: "Menu",
      /** The long-press sheet on a row in the iOS app: the row's own ways, under these names. */
      rowMenu: { open: "Open", call: "Call" },
      /** Home visits in the app's foot bar, where every name keeps one line. */
      tabVisits: "Home visits",
      /** My commitments in a member's foot bar, for the same reason; the menu keeps the whole name. */
      tabMine: "Commitments",
      menuTitle: `Your ${place}`,
      menuLabel: `${Place} menu`,
      menuCurrent: (section: string) => `${Place} menu, current section: ${section}`,
      keys: {
        title: "Keys for this workspace",
        description: "They work anywhere you are not typing.",
        show: "Show these keys",
        rooms: "Go to a room",
        step: "The room before or after",
        find: "Find in this room",
        act: "This room’s main button",
        close: "Close",
      },
      allSections: `All ${place} sections`,
      workspace: Place,
      current: "Current",
      skip: `Skip to your ${place}`,
      /** For someone who belongs to more than one: the picker in the bar. */
      groups: { label: `Choose a ${t.group}`, more: `More ${t.group}s` },
      signOut: "Sign out",
      /** Over the phone menu's Sign out: whose account it is, as the desktop bar shows it. */
      signedInAs: (name: string) => `Signed in as ${name}`,
      leaveSample: "Leave the sample",
      close: "Close",
      cancel: "Cancel",
      sampleMark: "Sample · made-up\u00a0people",
      /** After the conference's name in a room's kicker: "St. Example Conference · Sample". */
      sample: "Sample",
      language: "Language",
      typedStays: "Words people typed stay as they wrote them.",
      member: "Member",
      team: "Team",
      /** The button under a long list, and what each list holds. */
      more: {
        load: (what: string) => `Load more ${what}`,
        loading: (what: string) => `Loading ${what}…`,
        what: { commitments: "commitments", people: "people", invitations: "invitations", teams: "teams", announcements: "announcements", cover: "cover requests", timeOff: "time off", availability: "availability", tasks: "tasks", meetings: "meetings" },
      },
      limited: "Some lists here show only the first records. Use Load more in that section to see the rest.",
    },
    headings: {
      "help-line": { title: "Every call, returned.", deck: "Messages from the help line, and who is calling back." },
      neighbors: { title: "Neighbors, by name.", deck: "Each household and the help it has received, kept private." },
      treasury: { title: "Every gift, cared for.", deck: "What came in, what went out, and what it paid for." },
      reports: { title: "The year, added up.", deck: "Counts for your council’s yearly report, ready to print." },
      visits: { title: "Two by two.", deck: "Home visits, the pair who are going, and what they found." },
      tools: { title: "Your records, in and out.", deck: "From ServWare or a spreadsheet, and back out whenever you like." },
      team: {
        title: "A place on the team.",
        deck: "Each team, who serves on it, and how often.",
      },
      people: {
        title: "People, together.",
        deck: "Everyone here, with their role and their teams.",
      },
      commitments: {
        title: "Clear commitments.",
        deck: "See what’s covered, what’s open and what’s awaiting a reply.",
      },
      tasks: {
        title: "The little things matter.",
        deck: "Shared tasks and meetings, each with a clear next step.",
      },
      week: {
        title: "Good work, this week.",
        deck: "Your commitments, shared plans and the things to know.",
      },
      mine: {
        title: "Your part in it.",
        deck: "What you’ve said yes to, and how to prepare.",
      },
      "time-off": {
        title: "Room for life.",
        deck: "Keep your team informed while you take time away.",
      },
    },
    actions: {
      team: "Create a team",
      invite: "Invite someone",
      meeting: "Plan a meeting",
      timeOff: "Plan time off",
      announcement: "Share an announcement",
      commitment: "Add a commitment",
      commitmentTimes: (zone: string) => `Times are ${zone}.`,
      commitmentForm: {
        title: "Title", team: "Team", chooseTeam: "Choose a team…", starts: "Starts", ends: "Ends", where: "Where to meet",
        preparation: "Preparation", preparationHelp: "What should the person know or do beforehand? The title, place and this note also go on calendars and the printed week, so leave neighbors’ names and addresses out.",
        repeats: "Repeats", everyWeek: "Every week", everyWeeks: (count: number) => `Every ${enN(count)} weeks`,
        times: "How many times", timesHelp: "1 is a single date. Up to 52 within one year.", save: "Save", saving: "Saving…",
      },
      announcementSees: `Everyone in the ${t.group} sees this on This week.`,
      announcementForm: { title: "Title", message: "Message", save: "Share announcement", saving: "Sharing…" },
    },
    dateField: { choose: "Choose a day", done: "Done", chooseTime: "Choose a time", time: "time" },
    week: {
      /** The week's quilt: its one caption, which is also what a screen reader hears. */
      quilt: "This week: {calls} · {visits} · {yeses}",
      quiltCalls: (count: number) => (count === 1 ? "1 call returned" : `${enN(count)} calls returned`),
      quiltVisits: (count: number) => (count === 1 ? "1 visit" : `${enN(count)} visits`),
      quiltYeses: (count: number) => (count === 1 ? "1 yes" : `${enN(count)} yeses`),
      quiltNone: "Nothing yet this week",
      figures: { calls: "Calls waiting", visits: "Visits planned", requests: "Requests awaiting a yes", oldest: (days: number) => (days === 1 ? "Oldest call, 1 day" : `Oldest call, ${enN(days)} days`), toPay: (count: number) => `${enN(count)} approved, not yet paid` },
      startHere: { lead: "Start here", rest: "a call is waiting for your yes." },
      comingUp: "Coming up",
      cardFor: "For",
      cardForRest: "good work, this week.",
      nextSevenDays: "Next 7 days",
      printWeek: "Print the week",
      choiceAboveTitle: "Your next choice is above.",
      choiceAboveDetail:
        "Answer your invitation when you’re ready. Your other dates will show up here.",
      quietTitle: "A little breathing room.",
      quietDetail:
        "No commitments are scheduled in the next seven days. Later dates are in Commitments.",
      fromGroup: `From your ${t.group}`,
      noAnnouncementsTitle: "All quiet from the group.",
      noAnnouncementsDetail: "News from your coordinators will show up here.",
    },
    mine: {
      accepted: "Accepted commitments",
      addToCalendar: "Add these to your phone’s calendar",
      emptyTitle: "Room for your first yes.",
      emptyDetail:
        "Say yes to a commitment and it is kept here, with what to prepare.",
    },
    commitments: {
      weekByTeam: "This week by team",
      weekOf: (date: string) => `Week of ${date}`,
      covered: "Covered",
      placesOpen: (count: number) => (count === 1 ? "1 place open" : `${enN(count)} places open`),
      filterLabel: "Filter by team",
      allTeams: "All teams",
      noneForTeamTitle: "No upcoming dates for this team.",
      noneForTeamDetail: `Choose another team or view all teams to see the rest of your ${t.group}’s commitments.`,
      emptyTitle: "No dates yet.",
      emptyDetail:
        "Each date someone is needed is listed here, with who is going and what to prepare.",
      placeOpen: "A place is open",
      status: { accepted: "Accepted", open: "Open", cancelled: "Canceled" },
      viewPreparation: "View preparation",
      viewCommitment: "View commitment",
      details: "View details",
    },
    requests: {
      title: "Your choice",
      awaiting: (count: number) => `${enN(count)} awaiting your reply`,
      fallbackTitle: "Cover request",
      unavailable: "The date isn’t showing. Ask your coordinator for it.",
      accept: "Accept",
      decline: "Decline",
      accepted: "Commitment accepted. It’s on your list.",
      acceptedUnder: (place: string) => `Commitment accepted. It’s in ${place}.`,
      declined: "Request declined. Nothing was added to your list.",
    },
    detail: {
      cancelled:
        "This commitment is canceled. Its history is kept, and no one is expected to come.",
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
      yours: "Your time off",
      thisMonth: "This month",
      away: "Away",
      canHelp: "Can help",
      note: "Time off does not remove you from your teams. Existing commitments need a separate change so everyone knows what is covered.",
      remove: "Remove time off",
      removeDates: "Remove these dates",
      removed: "Time off removed.",
      restored: "Time off put back.",
      availabilityRemoved: "Available dates removed.",
      availabilityRestored: "Available dates put back.",
      emptyTitle: "Every day is open.",
      emptyDetail:
        "Add the dates you won’t be available.",
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
      teamSees: "Your team sees the days you are away.",
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
          : `${enN(count)} ${count === 1 ? "commitment" : "commitments"} affected`,
      explain:
        "Confirming will release only these commitments and record your time off. Team memberships and other dates stay the same.",
      back: "Back",
      saving: "Saving…",
      confirm: "Confirm time off",
      failed:
        "We couldn’t confirm these dates. Nothing was saved. Go back, look over the list, then confirm again.",
      saved: "Time off saved. Only the reviewed commitments were released.",
    },
    /** Tasks & meetings, as a member sees them. Planning a meeting and reviewing replies are leaders' tools and stay English. */
    tasks: {
      nextMeeting: "Next meeting",
      tasks: "Tasks",
      /** Under the open count on its slip, the figure standing apart. */
      openNoun: (count: number): string => (count === 1 ? "open" : "open"),
      add: "Add a task",
      markDone: "Mark done",
      /** Saved lines: the act, then the task by its own title. */
      markedDone: (title: string) => `Marked done. ${title}`,
      openAgain: (title: string) => `Open again. ${title}`,
      added: (title: string) => `Task added. ${title}`,
      undo: "Undo",
      reopen: "Open again",
      reopenTask: (title: string) => `Open again: ${title}`,
      done: "Done",
      open: "Open",
      emptyTitle: "No tasks yet.",
      emptyDetail: "Anything the group needs done is listed here, with who does it and by when.",
      meetings: "Meetings",
      going: "You are going",
      notGoing: "You can’t make it",
      waiting: "Awaiting your reply",
      changeReply: "Change reply",
      due: (date: string) => `Due ${date}`,
      attend: "Attend",
      decline: "Decline",
      noMeetingsTitle: "No meetings planned.",
      noMeetingsDetail: "Planned meetings will be kept here with each person’s reply.",
      preparing: "Preparing invitations…",
    },
    /** People, as a member sees it. Managing access and invitations are the owner's tools and stay English. */
    people: {
      roles: { owner: "Owner", coordinator: "Coordinator", member: "Member" },
      removed: "Access removed",
      waiting: "Not yet ready to serve",
    },
    /** Teams, as a member sees it. Adding and approving members are leaders' tools and stay English. */
    teams: {
      noDescription: "A team with room to contribute.",
      onTeam: "You’re on this team.",
      joined: "Joined {team}.",
      declined: "Declined the invitation to {team}.",
      invited: "You’re invited to this team. Joining does not accept a commitment.",
      join: "Join team",
      decline: "Decline",
      members: (count: number) => (count === 1 ? "1 member" : `${enN(count)} members`),
      viewMembers: "View members",
      hideMembers: "Hide members",
      coordinator: "Coordinator",
      member: "Member",
      invitedWaiting: "Invited, waiting to join",
      waitingApproval: "Waiting for the team’s coordinator",
      loadMore: "Load more members",
      loading: "Loading members…",
      emptyTitle: "Start with one team.",
      /** The room's foot, as Reports ends: one quiet sentence under a check. */
      footnote: "Taking time off does not take anyone off a team, and one member can serve on more than one.",
    },
    /** When something is not as usual: a save that failed, no connection, a room that did not open or is not this person's. */
    states: {
      opening: "Opening…",
      /** After a pull on the iPhone app's page when nothing is behind. */
      upToDate: "Up to date.",
      needed: "Fill this in.",
      neededChoice: "Choose one.",
      neededCheck: "Look at this again.",
      launchTitle: `We couldn’t open your ${place}.`,
      launchDeck: "Nothing was lost. Try again in a moment.",
      notSaved: "That didn’t go through. Try again.",
      offlineSave: "No connection right now.",
      kept: "Nothing was saved, and what you typed is still here.",
      tryAgain: "Try again",
      waiting: "Waiting for the connection. What you typed is kept and will be sent when it returns.",
      /** Under a yes or a no that was pressed, not typed, while the connection is down. */
      answerKept: "Your answer is kept. It will be sent when the connection returns.",
      offlineTitle: "No connection right now.",
      keptOffline: "Offline — showing what you last saw",
      /** After the title, where a room that was never opened is waiting for the connection. */
      offlineRoom: "This room opens when it returns.",
      offlineDeck: "What’s on screen stays. Your changes go out once this device is back online.",
      /** Said in green in the same strip for a moment once the connection returns. */
      /** The page shown in place of one that could not be fetched (/offline): its tab. */
      offlinePageTab: "No connection · Kind Helps",
      errorTitle: "This room didn’t open.",
      errorDeck: `What you saved is safe. Try again; if it still won’t open, the rest of your ${place} is in the menu.`,
      privateTitle: "Kept private.",
      privateDeck: `This room is made from the records of the ${t.neighbors} we help, so only coordinators open it. Your commitments and your team are where they always are.`,
      /** Tools, for a member: it brings whole files of records in and takes them out. */
      privateDeckTools: `This room brings records in from a file and downloads them all, including the ${t.neighbors}’ private details, so it opens to the ${t.group}’s owner and coordinators only. Your commitments and your team are where they always are.`,
      /** Treasury, for a member: money in and out, and who it paid. */
      privateDeckTreasury: `This room holds the ${t.group}’s money and who it paid, so only coordinators open it. Your commitments and your team are where they always are.`,
      privateAction: "My commitments",
      missingTitle: "This page isn’t here.",
      missingDeck: `The address may be old or mistyped. Your ${place} is where you left it.`,
      missingAction: `Go to your ${place}`,
    },
    notices: {
      failed: "That change couldn’t be saved. Try again.",
      /** A refusal the backend says in English, in this language, keyed by the English sentence. */
      refused: {
        ...Object.fromEntries([...Object.values(refusals), ...Object.keys(serverRefusalsEs)].map((sentence) => [sentence, notFound.test(sentence) ? `${sentence} ${nextStep.en}` : sentence])),
        ...Object.fromEntries(Object.entries(serverRefusalsPlain).map(([sentence, said]) => [sentence, said.en])),
      } as Record<string, string>,
      /** A refusal built around a name or a number: its pattern, and how this language says it. */
      refusedLike: serverRefusalPatternsEs.map(([pattern]) => [pattern, (...parts: string[]) => sayLikeEnglish(pattern, parts)] as const) as ReadonlyArray<
        readonly [RegExp, (...parts: string[]) => string]
      >,
    },
    visits: {
      title: "Home visits",
      count: (count: number) => `${enN(count)} ${count === 1 ? "visit" : "visits"}, always with a partner`,
      notSaved: "Your answer was not saved. Try again.",
      on: (street: string) => `A visit on ${street}`,
      nearby: "a street nearby",
      partnerOpen: "Your coordinator is asking a second visitor.",
      partner: (name: string) => `With ${name}. Your coordinator has the visit sheet.`,
      go: "I’ll go",
      cannot: "I can’t go",
      going: "You’re going",
      notGoing: "You can’t go",
      cannotAfterAll: "I can’t go after all",
      canAfterAll: "I can go after all",
    },
    /** The Monday note: fixed sentences chosen from the week's counts. */
    /** The kinds of help a request can be for, as a record line or a form names them. */
    kinds: { rent: "Rent", utility: "Utility bill", food: "Food", voucher: "Thrift store voucher", other: "Other help" },
    /** The private address that puts a person's shifts and visits on their own phone's calendar. */
    calendar: {
      title: "On your own calendar",
      deck: "Your shifts and home visits can appear in the calendar already on your phone. Set it up once and it stays up to date by itself.",
      apple: "Add to Apple Calendar",
      google: "Add to Google Calendar",
      outlook: "Add to Outlook",
      addressLabel: "Your private calendar address",
      copy: "Copy address",
      share: "Share address",
      copied: "Copied",
      copiedStatus: "Address copied.",
      privacy: "This address is yours alone; anyone who has it can see when and where you serve, and the preparation written for each commitment. A home visit shows the time and the street, never a neighbor’s name or need. If it reaches the wrong hands, make a new one and the old one stops working.",
      makeNew: "Make a new address",
      makeNewTitle: "Make a new address?",
      makeNewDetail: "The old address stops working straight away. You will need to add the new one to your calendar again.",
      get: "Get my calendar address",
      finding: "Finding your calendar",
      failed: "Your calendar address could not be made. Nothing has changed; check your connection, then try again.",
      /** Offline, where no second line follows: what did not happen, and when to try. */
      offline: "No connection right now. The address wasn’t made, so try again when you’re back online.",
    },
    /** The week as a sheet of paper for a wall or a door. */
    rota: {
      title: "The week on paper",
      deck: "For the parish office wall, the sacristy door, or anyone who would rather hold it.",
      before: "Week before",
      after: "Week after",
      print: "Print this week",
      time: "Time",
      what: "What",
      where: "Where",
      who: "Who",
      none: "Nothing planned",
      open: "Open",
      quietTitle: "A quiet week.",
      quietDetail: "Nothing is planned for these days yet. Commitments appear here as soon as they are added.",
      sample: "Sample",
      /** Followed by the month and year: "Printed November 2026". */
      printed: "Printed",
      /** Between two times of day, and between the first and last day of the week. */
      to: "to",
      through: "to",
    },
    monday: {
      title: "This week, in short.",
      weekOf: (date: string) => `Week of ${date}`,
      origin: "Counted from your records by fixed rules. The assistant writes none of it.",
      calls: (count: number) => (count === 1 ? "1 call is waiting to be returned." : `${enN(count)} calls are waiting to be returned.`),
      firstByAssistant: (count: number) => (count === 1 ? "1 was put first by the assistant from its note." : `${enN(count)} were put first by the assistant from their notes.`),
      firstByRules: (count: number) => (count === 1 ? "1 was put first from its note." : `${enN(count)} were put first from their notes.`),
      firstByPerson: (count: number) => (count === 1 ? "1 was put first by one of you." : `${enN(count)} were put first by one of you.`),
      oldest: (days: number) => (days === 1 ? "The oldest has waited 1 day." : `The oldest has waited ${enN(days)} days.`),
      visits: (count: number) => (count === 1 ? `1 ${t.visit} is planned.` : `${enN(count)} ${t.visits} are planned.`),
      open: (count: number) => (count === 1 ? "1 request is waiting for a decision." : `${enN(count)} requests are waiting for a decision.`),
      approved: (count: number) => (count === 1 ? "1 approved request is not yet paid." : `${enN(count)} approved requests are not yet paid.`),
      places: (count: number) => (count === 1 ? "1 place is open in the next seven days." : `${enN(count)} places are open in the next seven days.`),
      away: (count: number) => (count === 1 ? `1 ${t.member} is away this week.` : `${enN(count)} ${t.members} are away this week.`),
      done: "Done reading",
      read: "Read",
      readLabel: "Read the Monday note",
      /** The note as one line, when something else already holds the sheet's place. */
      brief: {
        label: "Monday note",
        calls: (count: number) => (count === 1 ? "1 call to return" : `${enN(count)} calls to return`),
        open: (count: number) => (count === 1 ? "1 request to decide" : `${enN(count)} requests to decide`),
        approved: (count: number) => (count === 1 ? "1 approved request to pay" : `${enN(count)} approved requests to pay`),
        visits: (count: number) => (count === 1 ? `1 ${t.visit} planned` : `${enN(count)} ${t.visits} planned`),
        places: (count: number) => (count === 1 ? "1 place open" : `${enN(count)} places open`),
        away: (count: number) => (count === 1 ? `1 ${t.member} away` : `${enN(count)} ${t.members} away`),
      },
    },
    /** The check before the yearly report. Each line points a person to one record; nothing is changed for them. */
    yearCheck: {
      title: "Before you send it",
      count: (count: number) => `${enN(count)} ${count === 1 ? "record" : "records"} to look at`,
      clear: "Everything adds up.",
      approvedNotPaid: "Approved more than a month ago, and no payment is recorded.",
      paidNoPayment: "Marked paid, and no payment is in the ledger.",
      visitNoHours: "A finished visit with no hours written down.",
      noteSaysPaid: "The note says this was paid, and no payment is recorded.",
      visitNotMarked: "The note says this visit happened, and it is not marked done.",
      byRule: "Found by counting.",
      byAssistant: "The assistant read the note. Read it yourself before you say yes.",
      open: "Open the record",
      putAway: "Hide the check",
      /** What was looked over. The screen puts the two counts and the time of day in the marked places. */
      checked: "Checked {requests}, {visits} and the ledger, today at {time}.",
      requests: (count: number) => (count === 1 ? "1 request" : `${enN(count)} requests`),
      visits: (count: number) => (count === 1 ? "1 visit" : `${enN(count)} visits`),
      show: (count: number) => `Show the ${enN(count)} records`,
      hide: (count: number) => `Hide the ${enN(count)} records`,
      openShort: "Open",
      /** One record said in a line: "Rent, $450, approved Nov 3" or "Home visit, Nov 3". */
      happened: { open: "received", approved: "approved", paid: "marked paid", declined: "declined", closed: "closed" },
      visit: "Home visit",
    },
    /** Why the assistant put a call first. A person can always move it. */
    urgent: {
      label: "Call first",
      origin: "Put first from what the note says. You can move it.",
      originAssistant: "Put first by the assistant from what the note says. You can move it.",
      shutoff: (day: number) => (day ? `Shut-off on the ${day}${["th", "st", "nd", "rd"][day % 100 > 10 && day % 100 < 14 ? 0 : Math.min(day % 10, 4) % 4]}` : "Shut-off"),
      eviction: (day: number) => (day ? `Eviction on the ${day}${["th", "st", "nd", "rd"][day % 100 > 10 && day % 100 < 14 ? 0 : Math.min(day % 10, 4) % 4]}` : "Eviction"),
      noFood: "No food",
      hungry: "Has not eaten",
      child: "A child",
      elder: "Elderly",
      alone: "Lives alone",
      medical: "A medical need",
      notUrgent: "Not urgent",
      /** The row's own press that moves a call to the top, said as what it does. */
      putFirst: "Put this call first",
    },
    /** What a person reads beside anything the assistant drafted. */
    assistant: {
      guide: {
        link: "How the assistant works here",
        title: "How the assistant works here",
        deck: `It helps your ${t.group} read call notes faster. It decides nothing about who is helped.`,
        what: "What it is",
        whatDetail: "One small model, Jev (version jev-1.14.0). It can only answer yes or no and pick from a fixed list. It cannot write: every sentence on these screens is fixed text in the app.",
        where: "Where it works",
        whereDetail: "It checks the request that fixed rules draft from a call note, puts urgent calls first, points to records worth a second look before the yearly report, and confirms a new team’s details from its description. The Monday note is counted by fixed rules; the assistant writes none of it.",
        never: "What is taken out",
        neverDetail: `A ${t.neighbor}’s name, phone, email or address. Fixed rules take them out of a note before it leaves, so an unusual spelling could slip through. The owner and coordinators can open a draft to see exactly what was read.`,
        person: "Who decides",
        personDetail: "A person. Every draft waits for a yes, and no request is saved before it. A call the assistant puts first shows why, and can be moved back. When the assistant is not sure, it leaves a blank instead of a guess.",
        limit: "Its limits",
        limitDetail: (checks: number) => `${enN(checks)} checks a month for each ${t.group}, and five a minute for each person. Past that, or when it cannot be reached, the screens work by fixed rules and say so.`,
        measured: "How it was measured",
        measuredDetail: (date: string) =>
          `On ${m.notes} made-up call notes kept apart from the ones it was adjusted on, it filled ${m.right} of ${m.right + m.blank + m.wrong} fields correctly, left ${m.blank} blank for a person and got ${m.wrong} wrong (measured ${date}). An earlier run got one wrong; we fixed the rule behind it, so those notes have now shaped one rule. This is a small test, and Spanish notes are a small part of it.`,
      },
      /** The foot of a draft: what was read, what was never sent, what a blank means, and who decides. */
      made: { checked: "Filled in from the call note; the assistant checked the kind of help and what kind of payee it is.", review: "Filled in from the call note by fixed rules. The assistant could not check it, so read each detail against the note." },
      unsaved: "Nothing is saved until you say so.",
      show: "What the assistant saw",
      hide: "Hide what the assistant saw",
      limits: {
        read: "It read",
        readDetail: "Only this call note. Names, phones, emails and addresses were taken out before it left.",
        notSent: "This draft was made by fixed rules alone. The assistant did not check it.",
        does: "It does",
        doesDetail: "It answers yes or no and picks from a fixed list. It writes no words: the quote above is the note’s own.",
        blank: "A blank",
        blankDetail: "The note did not say it plainly, or the assistant was not sure. It leaves a blank before it guesses.",
        person: "You decide",
        personDetail: "A person saves every request, and a person decides on help. The assistant decides nothing about who is helped.",
        question: "Question",
        answer: "Answer",
        yes: "Yes",
        sentInEnglish: "Questions sent in English, as they were sent.",
        model: (m: string) => `Answered by ${m}.`,
      },
      removed: { name: "name", phone: "phone", email: "email", address: "address", date: "date" },
      notes: {
        kindSeveral: { why: "The note mentions more than one kind of help.", act: "Choose one kind, or make a request for each." },
        kindMissing: { why: "The note does not say what kind of help is asked for.", act: "Choose the kind of help." },
        amountSeveral: { why: "The note gives more than one amount.", act: "Enter the amount asked for." },
        amountMissing: { why: "The note does not give an amount.", act: "Enter the amount asked for." },
        payee: { why: "Who is paid is not filled in yet.", act: `Confirm who is paid: the landlord, utility or store, never the ${t.neighbor}.` },
        doubtful: { why: "Part of the note is a question or is unsure, so it was left out.", act: "Read the whole note before you save." },
        confirmKind: { why: "The assistant was not sure of the kind of help.", act: "Confirm the kind of help." },
        confirmPayee: { why: "The assistant was not sure what kind of payee it is.", act: "Confirm the kind of payee." },
      },
      title: "Drafted for you",
      waiting: (count: number) => (count === 1 ? "Waiting for your yes" : `${enN(count)} waiting for your yes`),
      origin: "Filled in from the call note by fixed rules. Nothing is saved until you say so.",
      checked: "The assistant checked the kind of help and what kind of payee it is against the note.",
      review: "The assistant could not check this. Read each detail against the note.",
      approve: "Save this request",
      change: "Change the draft",
      discard: "Discard the draft",
      saved: "Saved to the record",
      approved: `Request saved. The ${t.group} decides next.`,
      /** The draft's own sheet, sentence by sentence, so it reads whole in each language. */
      sheet: {
        newCaller: "New caller",
        noName: "A caller who gave no name",
        calledOn: (day: string) => `called on ${day}`,
        nothingYet: "Nothing to draft from this note yet",
        aRequest: "A request",
        to: (payee: string) => ` to ${payee}`,
        blanks: "A draft with blanks",
        notSaid: { kind: "the kind of help", amount: "the amount", both: "the kind of help or the amount" },
        noteDoesNotSay: (what: string) => `The note does not say ${what}.`,
        unpaid: "Who is paid is not filled in yet.",
        yours: (count: number): string => (count > 1 ? "Those are yours to add." : "That is yours to add."),
        takenAt: (time: string) => `From the ${time} message.`,
        notOnFile: (name: string) => `${name || "The caller"} isn’t on file yet.`,
        addFirst: (name: string) => `First, add ${name || "the caller"} as a ${t.neighbor}.`,
        addAndSave: (name: string) => (name ? `Add ${name} as a ${t.neighbor}` : `Add as a ${t.neighbor}`),
        write: "Write the request",
        fill: "Fill in what is missing",
      },
    },
    welcome: {
      pass: "Pass the card",
      hint: "Pass the card to begin.",
      /** The sheet after a first sign-up, before anyone belongs anywhere. The door says "conference" whatever the word set. */
      first: {
        createKicker: "A small beginning", joinKicker: "An invitation to belong",
        createTitle: "Make room for your people.", joinTitle: "Your people are here.",
        createDeck: "Give your conference a private place to organize its people, plans and acts of care.",
        joinNamedBefore: "You are invited to join", joinNamedAfter: ". You’ll choose the commitments you accept.",
        joinDeck: "Use your invitation to join your conference. You’ll choose the commitments you accept.",
        choose: "Choose how to begin", start: "Start a conference", invited: "I have an invitation",
        yourName: "Your name", conferenceName: "Conference name", timeZone: "Time zone for all times",
        what: "A conference is the parish team that answers the help line and visits in pairs.",
        note: "Only invited members can open yours.",
        fromLink: "Your invitation came with the link you opened. Joining does not accept a commitment.",
        code: "Invitation code", codeHelp: "Use the code supplied by your coordinator. Joining does not accept a commitment.",
        creating: "Creating your conference…", joining: "Joining your conference…", create: "Create conference", join: "Join conference",
        // The button named in each line is `create` or `join` word for word.
        notSaved: "We couldn’t save that. Your entries are still here. Press Create conference again.",
        notSavedJoin: "We couldn’t save that. Your entries are still here. Press Join conference again.",
        addName: "Add your name.", addConferenceName: "Add the conference’s name.", addCode: "Add your invitation code.",
      },
    },
    /** Each room that keeps its own table (./rooms): the rooms a leader works in. */
    rooms: {
      helpLine: helpLineWords.en(t, place),
      helpLineForms: helpLineFormsWords.en(t, place),
      neighbors: neighborsWords.en(t, place),
      visitsRoom: visitsRoomWords.en(t, place),
      treasury: treasuryWords.en(t, place),
      reports: reportsWords.en(t, place),
      tools: toolsWords.en(t, place),
      peopleRoom: peopleRoomWords.en(t, place),
      sheets: sheetsWords.en(t, place),
      firstDays: firstDaysWords.en(t, place),
    },
  };
}

export type Words = ReturnType<typeof en>;
