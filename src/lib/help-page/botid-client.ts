import { initBotId } from "botid/client/core";

/**
 * The one script on /help and /ayuda (built to public/help-botid.js by scripts/help-script.mts). Vercel BotID judges a
 * request only when its headers come with it, and it adds them only to fetch and XMLHttpRequest, never to a plain form
 * post. So a form on these pages is sent with fetch, and the page that comes back replaces this one, as a plain post
 * would. If fetch fails, the form is posted plainly; the server, with no BotID headers, answers with the 211 page. With no
 * connection at all, the form stays and says it was not sent.
 */
type HelpWindow = Window & { khBotId?: true };
const here = window as HelpWindow;
// document.open keeps the window, so BotID is set up once even as answer pages replace the document.
if (!here.khBotId) {
  here.khBotId = true;
  initBotId({ protect: [{ path: "/help", method: "POST" }, { path: "/ayuda", method: "POST" }] });
}

/**
 * With no connection a plain post only reaches the browser's own error page, and what was typed is left behind: the form
 * stays as it is and says so (its send button's data-offline, in the page's language), to be sent again once online.
 */
function sayOffline(form: HTMLFormElement, pressed: HTMLElement | null) {
  const offline = form.querySelector<HTMLElement>("[data-offline]")?.dataset.offline;
  if (navigator.onLine || !offline) return false;
  let said = form.querySelector<HTMLElement>("p[data-offline-note]");
  if (!said) {
    said = document.createElement("p");
    said.className = "problem";
    said.setAttribute("role", "alert");
    said.dataset.offlineNote = "";
    (pressed?.closest("p") ?? form).before(said);
  }
  said.textContent = offline ?? "";
  return true;
}

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "post") return;
  const target = new URL(form.action, location.href);
  if (target.origin !== location.origin || (target.pathname !== "/help" && target.pathname !== "/ayuda")) return;
  event.preventDefault();
  const pressed = event.submitter;
  // Offline, BotID's fetch waits for its challenge with no end, so nothing is tried: the form says so at once.
  if (sayOffline(form, pressed)) return;
  const body = new FormData(form);
  // The pressed button's own name and value, as a plain post would send them.
  if ((pressed instanceof HTMLButtonElement || pressed instanceof HTMLInputElement) && pressed.name) body.append(pressed.name, pressed.value);
  for (const button of Array.from(form.querySelectorAll("button"))) button.disabled = true;
  // On a slow line the pressed button says it is sending (data-sending, in the page's language), so no one presses twice.
  const label = pressed instanceof HTMLButtonElement ? pressed.textContent : null;
  if (pressed instanceof HTMLButtonElement && pressed.dataset.sending) pressed.textContent = pressed.dataset.sending;
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
      if (pressed instanceof HTMLButtonElement && label !== null) pressed.textContent = label;
      if (sayOffline(form, pressed)) return;
      HTMLFormElement.prototype.submit.call(form);
    });
});
