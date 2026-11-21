import { initBotId } from "botid/client/core";

/**
 * The one script on /help and /ayuda (built to public/help-botid.js by scripts/help-script.mts). Vercel BotID judges a
 * request only when its headers come with it, and it adds them only to fetch and XMLHttpRequest, never to a plain form
 * post. So a form on these pages is sent with fetch, and the page that comes back replaces this one, as a plain post
 * would. If fetch fails, the form is posted plainly; the server, with no BotID headers, answers with the 211 page.
 */
type HelpWindow = Window & { khBotId?: true };
const here = window as HelpWindow;
// document.open keeps the window, so BotID is set up once even as answer pages replace the document.
if (!here.khBotId) {
  here.khBotId = true;
  initBotId({ protect: [{ path: "/help", method: "POST" }, { path: "/ayuda", method: "POST" }] });
}

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "post") return;
  const target = new URL(form.action, location.href);
  if (target.origin !== location.origin || (target.pathname !== "/help" && target.pathname !== "/ayuda")) return;
  event.preventDefault();
  const body = new FormData(form);
  // The pressed button's own name and value, as a plain post would send them.
  const pressed = event.submitter;
  if ((pressed instanceof HTMLButtonElement || pressed instanceof HTMLInputElement) && pressed.name) body.append(pressed.name, pressed.value);
  for (const button of Array.from(form.querySelectorAll("button"))) button.disabled = true;
  fetch(target.toString(), { method: "POST", body, credentials: "same-origin" })
    .then(async (answer) => {
      const page = await answer.text();
      if (answer.redirected) history.replaceState(null, "", answer.url);
      document.open();
      document.write(page);
      document.close();
      window.scrollTo(0, 0);
    })
    .catch(() => {
      for (const button of Array.from(form.querySelectorAll("button"))) button.disabled = false;
      HTMLFormElement.prototype.submit.call(form);
    });
});
