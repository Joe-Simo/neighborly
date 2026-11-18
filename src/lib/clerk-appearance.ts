/**
 * Clerk draws one thing of its own in this app: the human check it raises over the page when its servers ask for
 * one ("Verifying your request"). It is set in our paper and ink through Clerk's documented `appearance` option:
 * the paper ground, the ink, our faces (the serif of our titles for its title), a flat ink shade behind it with no
 * blur, one ink focus ring, the still ochre waiting ring in place of a spinner, and plum, not red, for anything gone
 * wrong. The check itself is Cloudflare's frame, drawn in its light theme.
 */
const ink = "#283c32";
const paper = "#f7f4ed";
const line = "#d9ddce";

export const clerkAppearance = {
  variables: {
    colorBackground: paper,
    colorForeground: ink,
    colorMutedForeground: "#656d61",
    colorPrimary: ink,
    colorPrimaryForeground: paper,
    colorDanger: "#6f5f93",
    // Clerk draws its one focus ring in this colour.
    colorRing: ink,
    colorBorder: line,
    colorShadow: "rgb(40 60 50 / 0.22)",
    colorModalBackdrop: "rgb(40 60 50 / 0.16)",
    fontFamily: '"Source Sans 3", "Source Sans 3 Fallback", sans-serif',
    fontFamilyButtons: '"Source Sans 3", "Source Sans 3 Fallback", sans-serif',
    fontSize: "16px",
    borderRadius: "6px",
  },
  elements: {
    modalBackdrop: { backdropFilter: "none", WebkitBackdropFilter: "none", alignItems: "center", padding: "24px" },
    cardBox: {
      border: `1px solid ${line}`,
      borderRadius: "6px",
      background: paper,
      boxShadow: "-5px -9px 22px -12px rgb(40 60 50 / 0.22), 0 18px 40px -18px rgb(40 60 50 / 0.4)",
    },
    card: { background: paper, border: "none", boxShadow: "none" },
    footer: { background: paper, color: "#656d61", fontSize: "15px" },
    // Its title in the serif of the sheet's titles.
    headerTitle: { fontFamily: '"Newsreader", "Newsreader Fallback", Georgia, serif', fontWeight: 400, fontSize: "30px", lineHeight: 1.1, letterSpacing: "-0.6px", color: ink },
    // Its turning spinner is our still waiting ring: ochre, as the sheet's "Please wait…", and it does not turn.
    spinner: {
      width: "20px",
      height: "20px",
      minWidth: "20px",
      minHeight: "20px",
      border: "3px solid #a8791f",
      animation: "none",
    },
    // Clerk's own links in the foot are touch targets like ours.
    footerPagesLink: { minHeight: "44px", display: "inline-flex", alignItems: "center", fontSize: "15px", color: "#656d61" },
  },
  captcha: { theme: "light", size: "flexible" },
} as const;
