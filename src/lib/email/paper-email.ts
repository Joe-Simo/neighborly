import type { Language, WordSet } from "../words/sets";

/**
 * The emails Kind Helps sends through Resend, on the same paper as the app: the wordmark, one head in the display
 * face (with the faces every mail app has behind it), the words, one way in, and a quiet foot. Colour carries no
 * meaning here, so the sheet is ink on paper; the one link is ink too. Nothing is an image, so a mail app that
 * blocks pictures shows the whole email. Each comes with a plain-text twin that says the same thing.
 */
type EmailKind = "invitation" | "cover_request" | "meeting";
type Email = { subject: string; text: string; html: string };

const group = { en: { general: "group", vincentian: "conference" }, es: { general: "grupo", vincentian: "conferencia" } } as const;

type Said = { subject: string; head: string; body: string; action: string; foot: string };

function said(kind: EmailKind, language: Language, set: WordSet, place: string): Said {
  const g = group[language][set];
  if (language === "es") {
    switch (kind) {
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
    }
  }
  switch (kind) {
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
  }
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The faces: the site's own first, then the ones every mail app has, so the shape holds without a download.
const display = "Newsreader,Georgia,'Times New Roman',serif";
const body = "'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif";

export function paperEmail({ kind, language, set, place, link }: { kind: EmailKind; language: Language; set: WordSet; place: string; link: string }): Email {
  const s = said(kind, language, set, place);
  const text = [s.head, "", s.body, "", `${s.action}: ${link}`, "", s.foot, "", "kind helps"].join("\n");
  const e = { head: escape(s.head), body: escape(s.body), action: escape(s.action), foot: escape(s.foot), link: escape(link) };
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
