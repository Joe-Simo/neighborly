import type { Language, WordSet } from "../words/sets";

/**
 * The emails Kind Helps sends through Resend, on the same paper as the app: the wordmark, one head in the display
 * face (with the faces every mail app has behind it), the words, one way in, and a quiet foot. Colour carries no
 * meaning here, so the sheet is ink on paper; the one link is ink too. Nothing is an image, so a mail app that
 * blocks pictures shows the whole email. Each comes with a plain-text twin that says the same thing.
 */
type EmailKind = "invitation" | "cover_request" | "meeting" | "digest" | "announcement" | "help_code" | "intake_late" | "intake_late_owner" | "intake_paused" | "intake_new";
/** The week's counts for the Monday email: numbers only, never a name, so nothing about a household leaves in a mailbox. */
type WeekCounts = { waiting: number; overdue: number; approved: number; budget: number | null };
/** An announcement carries its own words: its title becomes the head and its message the body. */
type Content = { title: string; body: string };
type Email = { subject: string; text: string; html: string };

const group = { en: { general: "group", vincentian: "conference" }, es: { general: "grupo", vincentian: "conferencia" } } as const;

type Said = { subject: string; head: string; body: string; action: string; foot: string };

function said(kind: EmailKind, language: Language, set: WordSet, place: string, week?: WeekCounts, content?: Content, count = 1): Said {
  const g = group[language][set];
  if (kind === "digest") return weekSaid(language, place, week ?? { waiting: 0, overdue: 0, approved: 0, budget: null });
  if (language === "es") {
    switch (kind) {
      // For the intake notices, place is the team's name. Counts only: no name, contact or need leaves in a mailbox.
      case "intake_late": return {
        subject: `Peticiones web esperando en ${place}`,
        head: "Alguien espera una llamada.",
        body: `Hay peticiones del formulario web en ${place} que pasaron su día hábil sin contacto. Ábrelas en la línea de ayuda.`,
        action: "Abrir la línea de ayuda",
        foot: "Recibes este recordatorio cada día mientras haya peticiones atrasadas.",
      };
      case "intake_late_owner": return {
        subject: `Peticiones web sin respuesta en ${place}`,
        head: "Llevan tres días hábiles esperando.",
        body: `Hay peticiones del formulario web en ${place} que llevan tres días hábiles o más sin contacto. Nada se cierra solo: alguien del equipo tiene que llamar.`,
        action: "Abrir la línea de ayuda",
        foot: "Recibes este correo porque eres responsable del grupo en Kind Helps.",
      };
      // For intake_new, how many requests reached the Help line in the last few minutes: a count, never a person.
      case "intake_new": return {
        subject: count === 1 ? `1 nueva petición de ayuda en ${place}` : `${count} nuevas peticiones de ayuda en ${place}`,
        head: count === 1 ? "1 nueva petición de ayuda." : `${count} nuevas peticiones de ayuda.`,
        body: `Llegaron a la línea de ayuda de ${place}. Ábrela para verlas y devolver la llamada.`,
        action: "Abrir la línea de ayuda",
        foot: "Puedes apagar estos correos en la línea de ayuda.",
      };
      case "intake_paused": return {
        subject: `El formulario web de ${place} está en pausa`,
        head: "Pausamos el formulario web.",
        body: `Nadie que coordina en ${place} ha abierto la línea de ayuda en 30 días, así que las peticiones nuevas van al equipo más cercano y las abiertas se pasaron. Puedes volver a activarlo en la línea de ayuda.`,
        action: "Abrir la línea de ayuda",
        foot: "Recibes este correo porque eres responsable del grupo en Kind Helps.",
      };
      // For help_code, place is the six-digit code: the person asked for help on the web form and confirms with it.
      case "help_code": return {
        subject: `Tu código de Kind Helps: ${place}`,
        head: `Tu código de Kind Helps es ${place}.`,
        body: "Escríbelo en la página donde empezaste. El enlace de abajo es tu página privada para ver cómo va.",
        action: "Ver cómo va mi petición",
        foot: "Si no lo pediste, puedes ignorar este correo y no se guardará nada.",
      };
      case "invitation": return {
        subject: `Te invitan a ${place} en Kind Helps`,
        head: "Te invitan a unirte.",
        body: `Tu ${g}, ${place}, lleva en Kind Helps su línea de ayuda, sus visitas y sus cuentas. El enlace es solo para ti.`,
        action: "Ver la invitación",
        foot: "La invitación vence en siete días. Si no la esperabas, puedes ignorar este correo.",
      };
      case "cover_request": return {
        subject: "Te piden cubrir un compromiso",
        head: "¿Puedes cubrirlo?",
        body: `Una persona que coordina en ${place} busca a alguien para un compromiso. Inicia sesión para ver cuál es y decir si puedes.`,
        action: "Ver la petición",
        foot: "Recibes este correo porque aceptas peticiones para cubrir turnos. Puedes dejar de recibirlas en Kind Helps.",
      };
      case "meeting": return {
        subject: `Una reunión de ${place}`,
        head: "Te invitan a una reunión.",
        body: "Inicia sesión para ver los detalles y responder.",
        action: "Ver la reunión",
        foot: `Recibes este correo porque eres parte de ${place} en Kind Helps.`,
      };
      case "announcement": return {
        subject: content ? `Aviso de ${place}: ${content.title}` : `Aviso de ${place}`,
        head: content?.title ?? "Un aviso nuevo.",
        body: content?.body ?? "Inicia sesión para leerlo.",
        action: "Abrir Kind Helps",
        foot: `Recibes este correo porque eres parte de ${place} en Kind Helps. El aviso también está en la página de inicio.`,
      };
    }
  }
  switch (kind) {
    case "intake_late": return {
      subject: `Web requests waiting at ${place}`,
      head: "Someone is waiting for a call.",
      body: `There are requests from the web form at ${place} past their business day with no contact. Open them on the Help line.`,
      action: "Open the Help line",
      foot: "You get this reminder each day while requests are late.",
    };
    case "intake_late_owner": return {
      subject: `Web requests unanswered at ${place}`,
      head: "Three business days waiting.",
      body: `There are requests from the web form at ${place} waiting three business days or more with no contact. Nothing closes on its own: someone on the team needs to call.`,
      action: "Open the Help line",
      foot: "You get this email because you’re responsible for the group on Kind Helps.",
    };
    case "intake_new": return {
      subject: count === 1 ? `1 new request for help at ${place}` : `${count} new requests for help at ${place}`,
      head: count === 1 ? "1 new request for help." : `${count} new requests for help.`,
      body: `They reached the Help line at ${place}. Open it to see them and call back.`,
      action: "Open the Help line",
      foot: "You can turn these emails off on the Help line.",
    };
    case "intake_paused": return {
      subject: `The web form for ${place} is paused`,
      head: "We paused your web form.",
      body: `No one who coordinates at ${place} has opened the Help line in 30 days, so new requests go to the nearest other team and the open ones were passed on. You can turn it back on from the Help line.`,
      action: "Open the Help line",
      foot: "You get this email because you’re responsible for the group on Kind Helps.",
    };
    case "help_code": return {
      subject: `Your Kind Helps code: ${place}`,
      head: `Your Kind Helps code is ${place}.`,
      body: "Type it on the page where you started. The link below is your private page to see how it is going.",
      action: "See how my request is going",
      foot: "If you didn’t ask for it, you can ignore this email and nothing is kept.",
    };
    case "invitation": return {
      subject: `You’re invited to ${place} on Kind Helps`,
      head: "You’re invited to join.",
      body: `Your ${g}, ${place}, keeps its help line, its visits and its books on Kind Helps. The link is yours alone.`,
      action: "See the invitation",
      foot: "The invitation ends after seven days. If you weren’t expecting it, you can ignore this email.",
    };
    case "cover_request": return {
      subject: "A request to cover a commitment",
      head: "Can you cover it?",
      body: `A coordinator at ${place} needs someone for a commitment. Sign in to see which one and say whether you can.`,
      action: "See the request",
      foot: "You get this email because you take cover requests. You can stop them in Kind Helps.",
    };
    case "meeting": return {
      subject: `A meeting at ${place}`,
      head: "You’re invited to a meeting.",
      body: "Sign in to see the details and reply.",
      action: "See the meeting",
      foot: `You get this email because you’re part of ${place} on Kind Helps.`,
    };
    case "announcement": return {
      subject: content ? `Announcement from ${place}: ${content.title}` : `Announcement from ${place}`,
      head: content?.title ?? "A new announcement.",
      body: content?.body ?? "Sign in to read it.",
      action: "Open Kind Helps",
      foot: `You get this email because you’re part of ${place} on Kind Helps. The announcement is on the home page too.`,
    };
  }
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The faces: the site's own first, then the ones every mail app has, so the shape holds without a download.
const display = "Newsreader,Georgia,'Times New Roman',serif";
const body = "'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif";

export function paperEmail({ kind, language, set, place, link, week, content, count }: { kind: EmailKind; language: Language; set: WordSet; place: string; link: string; week?: WeekCounts; content?: Content; count?: number }): Email {
  return render(language, said(kind, language, set, place, week, content, count), link);
}

/** One sheet of paper: the head, the words (a line break kept as one), the one way in, and the foot. */
function render(language: Language, s: Said, link: string): Email {
  const text = [s.head, "", s.body, "", `${s.action}: ${link}`, "", s.foot, "", "kind helps"].join("\n");
  const e = { head: escape(s.head), body: escape(s.body).replace(/\r?\n/g, "<br>"), action: escape(s.action), foot: escape(s.foot), link: escape(link) };
  const html = `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escape(s.subject)}</title>
<style>
  :root { color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    .page { background: #1c211e !important; }
    .sheet { background: #252b27 !important; border-color: #3a423c !important; }
    .ink { color: #ece6d8 !important; }
    .quiet { color: #b9b2a2 !important; }
    .rule { border-color: #3a423c !important; }
    .way { background: #ece6d8 !important; color: #1c211e !important; }
  }
  /* Outlook on the web marks its own dark mode on the body instead of answering the media query. */
  [data-ogsc] .ink { color: #ece6d8 !important; }
  [data-ogsc] .quiet { color: #b9b2a2 !important; }
  [data-ogsb] .page { background: #1c211e !important; }
  [data-ogsb] .sheet { background: #252b27 !important; }
  [data-ogsb] .way { background: #ece6d8 !important; }
  [data-ogsc] .way { color: #1c211e !important; }
  /* On a phone the sheet gives its words more of the width; the wordmark and the foot keep to the sheet's text edge. */
  @media (max-width: 480px) {
    .sheet { padding: 28px 22px 24px !important; }
    .edge { padding-left: 23px !important; padding-right: 23px !important; }
    .head { font-size: 30px !important; }
  }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#ebe5d6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="page" style="background:#ebe5d6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td class="ink edge" style="padding:0 37px 18px;font-family:${display};font-size:26px;line-height:1;letter-spacing:-0.5px;color:#283c32;">kind helps</td></tr>
<tr><td class="sheet" style="background:#f7f4ed;border:1px solid #ddd6c6;border-radius:3px;padding:36px 36px 32px;">
<h1 class="ink head" style="margin:0 0 18px;font-family:${display};font-weight:400;font-size:35px;line-height:1.08;letter-spacing:-0.6px;color:#283c32;">${e.head}</h1>
<p class="ink" style="margin:0 0 28px;font-family:${body};font-size:17px;line-height:1.55;color:#283c32;">${e.body}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="way" style="background:#283c32;border-radius:3px;">
<a href="${e.link}" class="way" style="display:inline-block;padding:13px 22px;font-family:${body};font-size:17px;font-weight:600;line-height:1.2;color:#f7f4ed;text-decoration:none;">${e.action}</a>
</td></tr></table>
<p class="quiet" style="margin:22px 0 0;font-family:${body};font-size:15px;line-height:1.5;color:#4f5d52;word-break:break-all;">${e.link}</p>
</td></tr>
<tr><td class="quiet rule edge" style="padding:18px 37px 0;font-family:${body};font-size:15px;line-height:1.5;color:#4f5d52;">${e.foot}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject: s.subject, text, html };
}

/** A member's language for email: the app speaks English and Spanish; any other choice reads English. */
export const emailLanguage = (language: string | undefined): Language => (language === "es" ? "es" : "en");

function weekSaid(language: Language, place: string, week: WeekCounts): Said {
  const n = new Intl.NumberFormat(language === "es" ? "es-US" : "en-US").format;
  const money = (cents: number) => new Intl.NumberFormat(language === "es" ? "es-US" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(cents / 100));
  if (language === "es") return {
    subject: `La semana en ${place}`,
    head: "Tu semana para decidir.",
    body: [
      week.waiting === 1 ? "1 petición espera una decisión." : `${n(week.waiting)} peticiones esperan una decisión.`,
      week.overdue === 1 ? "Una llamada espera respuesta desde hace dos días o más." : `${n(week.overdue)} llamadas esperan respuesta desde hace dos días o más.`,
      week.budget ? `Aprobado este mes: ${money(week.approved)} de ${money(week.budget)}.` : `Aprobado este mes: ${money(week.approved)}.`,
    ].join(" "),
    action: "Ver la semana",
    foot: "Sin nombres en este correo, a propósito. Puedes dejar de recibirlo en la misma página.",
  };
  return {
    subject: `The week at ${place}`,
    head: "Your week to decide.",
    body: [
      week.waiting === 1 ? "1 request is waiting on a decision." : `${n(week.waiting)} requests are waiting on a decision.`,
      week.overdue === 1 ? "1 call has waited two days or more for a callback." : `${n(week.overdue)} calls have waited two days or more for a callback.`,
      week.budget ? `Approved this month: ${money(week.approved)} of ${money(week.budget)}.` : `Approved this month: ${money(week.approved)}.`,
    ].join(" "),
    action: "See the week",
    foot: "No names in this email, on purpose. You can stop it on the same page.",
  };
}

/**
 * A meeting's minutes for every member: when it met, who came (a count), the decisions (counts), the reflection and the
 * minutes as typed with neighbors' names and addresses already taken out by the caller.
 */
export function minutesEmail(m: { language: Language; set: WordSet; place: string; title: string; start: number; timeZone: string; attended: number; approved: number; declined: number; reflection: string; minutes: string; link: string }): Email {
  const es = m.language === "es";
  const day = new Intl.DateTimeFormat(es ? "es-US" : "en-US", { dateStyle: "long", timeZone: m.timeZone }).format(m.start);
  const lines = es
    ? [`${m.title}, ${day}.`, `Asistieron ${m.attended}. Decisiones: ${m.approved} aprobadas, ${m.declined} rechazadas.`, m.reflection && `Reflexión:\n${m.reflection}`, m.minutes && `Acta:\n${m.minutes}`]
    : [`${m.title}, ${day}.`, `${m.attended} came. Decisions: ${m.approved} approved, ${m.declined} declined.`, m.reflection && `Reflection:\n${m.reflection}`, m.minutes && `Minutes:\n${m.minutes}`];
  return render(m.language, {
    subject: es ? `Acta de ${m.title}, ${m.place}` : `Minutes of ${m.title}, ${m.place}`,
    head: es ? "El acta de la reunión." : "The meeting’s minutes.",
    body: lines.filter(Boolean).join("\n\n"),
    action: es ? "Abrir Kind Helps" : "Open Kind Helps",
    foot: es ? "Sin nombres de las personas que ayudamos, a propósito." : "No names of the people we help, on purpose.",
  }, m.link);
}
