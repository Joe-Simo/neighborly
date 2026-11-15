"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { LogOut, Menu, Plus } from "lucide-react";
import { PaperSurface } from "@/components/paper-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { LiveArea } from "@/components/workspace/areas";
import { LiveDialog } from "@/components/workspace/live-dialog";
import {
  WorkspaceProvider,
  type LiveHeadAction,
  type Workspace,
} from "@/components/workspace/context";
import {
  actionTitles,
  headings,
  navigation,
  primaryActions,
  type ActionKind,
  type LiveHeadingOverride,
} from "@/components/workspace/navigation";
import { LanguageChooser } from "@/components/workspace/language-chooser";
import { ReliefPicture } from "@/components/workspace/relief";
import { sections } from "@/components/workspace/sections";
import type {
  LiveCommand,
  LiveConfirmation,
  LiveWorkspaceData,
} from "@/components/workspace/types";
import { CommitmentDetail } from "@/components/workspace/volunteer/commitment-detail";
import { LiveCommitmentEditor } from "@/components/workspace/volunteer/commitment-editor";
import { LiveCreateForm } from "@/components/workspace/volunteer/create-form";
import { LiveTimeOffForm } from "@/components/workspace/volunteer/time-off-form";
import { formatDate, words as wordsFor } from "@/lib/words";

export function LiveWorkspace({
  area,
  data,
  run,
  signOut,
  sampleVisitor = false,
  selectChurch,
  pagination,
  requestCommitments = [],
}: {
  area: LiveArea;
  data: LiveWorkspaceData;
  run: (command: LiveCommand) => Promise<{
    invitationToken?: string;
    delivery?: "not_sent" | "queued";
  } | null>;
  signOut: () => Promise<void>;
  /** Someone who came in by the sample link leaves the sample; they have no account to sign out of. */
  sampleVisitor?: boolean;
  selectChurch?: ReactNode;
  pagination?: ReactNode;
  requestCommitments?: LiveWorkspaceData["commitments"];
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const commitmentTrigger = useRef<HTMLButtonElement | null>(null);
  const outcomeNotice = useRef<HTMLDivElement | null>(null);
  const [selectedCommitment, setSelectedCommitment] = useState<
    LiveWorkspaceData["commitments"][number] | null
  >(null);
  const [editingCommitment, setEditingCommitment] = useState<
    LiveWorkspaceData["commitments"][number] | null
  >(null);
  const [confirmation, setConfirmation] = useState<LiveConfirmation | null>(
    null,
  );
  const [release, setRelease] = useState<
    LiveWorkspaceData["commitments"][number] | null
  >(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invitationLink, setInvitationLink] = useState("");
  const [invitationDelivery, setInvitationDelivery] = useState<
    "not_sent" | "queued"
  >("not_sent");
  const [teamFilter, setTeamFilter] = useState("");
  const [headingOverride, setHeadingOverride] =
    useState<LiveHeadingOverride | null>(null);
  const [headAction, setHeadAction] = useState<LiveHeadAction | null>(null);
  const words = wordsFor(data.user.language, data.church.wordSet);
  // Areas the words do not cover yet keep their English line.
  const menu: Partial<Record<LiveArea, string>> = words.menu;
  const actions: Partial<Record<ActionKind, string>> = words.actions;
  const translatedHeadings: Partial<Record<LiveArea, { title: string; deck: string }>> = words.headings;
  const ownPerson = data.people.find((person) => person.id === data.user.id);
  const isOwner = ownPerson?.role === "owner";
  const selected = selectedCommitment;
  const format = (time: number, options?: Intl.DateTimeFormatOptions) =>
    formatDate(words.locale, time, {
      timeZone: data.church.timeZone,
      month: "short",
      day: "numeric",
      ...options,
    });
  const when = (start: number, end: number) =>
    `${format(start, { weekday: "short" })} · ${format(start, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}–${format(end, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}`;
  const personName = (id: string | null) =>
    data.people.find((person) => person.id === id)?.name ??
    (id ? words.shell.member : words.detail.unassigned);
  const teamName = (id: string) =>
    data.teams.find((team) => team.id === id)?.name ?? words.shell.team;
  const [now] = useState(() => Date.now());
  async function perform(command: LiveCommand, success?: string) {
    setPending(true);
    setError("");
    setNotice("");
    if (command.type === "invite") setInvitationLink("");
    try {
      const result = await run(command);
      if (result?.delivery) setInvitationDelivery(result.delivery);
      if (result?.invitationToken)
        setInvitationLink(
          `${window.location.origin}/app?invite=${encodeURIComponent(result.invitationToken)}`,
        );
      if (command.type === "invite")
        setNotice(
          result?.delivery === "queued"
            ? "Invitation created and email queued. Delivery is not yet confirmed."
            : "Invitation created. No email was sent.",
        );
      else if (success) setNotice(success);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^.*?Uncaught Error:\s*/, "").split("\n")[0]
          : words.notices.failed,
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  function open(kind: ActionKind) {
    setError("");
    setDialog(kind);
  }
  const primary = primaryActions[area];
  // A menu line marked for leaders is shown only to coordinators and owners of the group.
  const leads = ownPerson?.role === "owner" || ownPerson?.role === "coordinator";
  const menuItems = navigation.filter((item) => leads || !("leadersOnly" in item));
  // On a phone the menu button says "Menu" and tells a screen reader which room this is.
  const menuLabel = menu[area] ?? navigation.find((item) => item.id === area)?.label;
  const navRef = useNavMarker(area);
  const mainRef = useRef<HTMLElement | null>(null);
  const waveRef = useArrival();
  useSystemTextSize();
  // The room being left steps back at once; the next one rises in when it arrives.
  const leave = (event: MouseEvent<HTMLAnchorElement>, id: LiveArea) => {
    setMobileMenuOpen(false);
    if (id === area || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const main = mainRef.current;
    if (!main) return;
    main.dataset.leaving = "";
    window.setTimeout(() => delete main.dataset.leaving, 1500);
  };
  const leaveLabel = sampleVisitor ? words.shell.leaveSample : words.shell.signOut;
  const Section = sections[area];
  const heading = headingOverride
    ? { ...headings[area], ...translatedHeadings[area], ...headingOverride }
    : { ...headings[area], ...translatedHeadings[area] };
  const workspace: Workspace = {
    area,
    data,
    requestCommitments,
    ownPerson,
    isOwner,
    pending,
    now,
    teamFilter,
    setTeamFilter,
    format,
    when,
    personName,
    teamName,
    perform,
    openAction: open,
    showCommitment: (item, trigger) => {
      commitmentTrigger.current = trigger;
      setError("");
      setSelectedCommitment(item);
    },
    confirm: setConfirmation,
    setHeading: setHeadingOverride,
    words,
    setHeadAction,
    focusOutcome: () =>
      requestAnimationFrame(() =>
        outcomeNotice.current?.focus({ preventScroll: true }),
      ),
  };
  return (
    <WorkspaceProvider value={workspace}>
    <div className="live-app" lang={words.locale}>
      <a className="live-skip" href="#workspace-content">{words.shell.skip}</a>
      <header className="live-header">
        <Link href="/" className="live-wordmark">
          kind helps
        </Link>
        {data.church.sample && <p className="live-sample-mark live-header-sample">Sample · made-up people</p>}
        <div className="live-header-actions">
          <div className="live-header-desk contents">
            {selectChurch}
            <LanguageChooser />
            <span className="live-account">
              {data.user.name || data.user.email}
            </span>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" /> {leaveLabel}
            </Button>
          </div>
          <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DialogTrigger asChild><Button variant="ghost" className="live-menu-trigger" aria-label={menuLabel ? words.shell.menuCurrent(menuLabel) : words.shell.menuLabel}><Menu aria-hidden="true" />{words.shell.menu}</Button></DialogTrigger>
            <DialogContent className="live-mobile-menu" onOpenAutoFocus={(event) => {
              // Opening the menu lands on the sheet itself, not on its first control.
              event.preventDefault();
              if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
            }}>
              <DialogHeader><DialogTitle>{words.shell.menuTitle}</DialogTitle><DialogDescription>{data.church.name}</DialogDescription>{data.church.sample && <p className="live-sample-mark">Sample · made-up people</p>}</DialogHeader>
              <div className="live-menu-rooms">
                <nav aria-label={words.shell.allSections}>{menuItems.map(({ id, label, icon: Icon }) => <Link key={id} href={`/app/${id}`} aria-current={area === id ? "page" : undefined} onClick={(event) => leave(event, id)}><Icon size={19} aria-hidden="true" /><span>{menu[id] ?? label}</span>{area === id && <span className="live-menu-current">{words.shell.current}</span>}</Link>)}</nav>
                {selectChurch}
              </div>
              <div className="live-menu-foot">
                <LanguageChooser />
                <Button variant="outline" className="live-menu-leave" disabled={pending} onClick={() => void signOut()}>
                  <LogOut size={17} aria-hidden="true" /> {leaveLabel}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <div className="live-layout">
        <nav className="live-nav" aria-label={words.shell.workspace} ref={navRef}>
          <span className="live-nav-marker" aria-hidden="true" />
          <p className="live-church-name" data-sample={data.church.sample ? "" : undefined}>{data.church.name}</p>
          {data.church.sample && <p className="live-sample-mark">Sample · made-up people</p>}
          {menuItems.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={`/app/${id}`}
              aria-current={area === id ? "page" : undefined}
              onClick={(event) => leave(event, id)}
            >
              <Icon aria-hidden="true" />
              {menu[id] ?? label}
            </Link>
          ))}
        </nav>
        <main
          className="live-main"
          id="workspace-content"
          tabIndex={-1}
          data-room={heading.room}
          ref={mainRef}
        >
          <div className="live-page-head" key={`head-${area}`}>
            {heading.art && (
              <div className="live-head-art">
                <ReliefPicture name={heading.art.picture} focus={heading.art.focus} />
              </div>
            )}
            <div className="live-head-words">
              <p className="live-kicker">
                {data.church.name}
                {data.church.sample ? " · Sample" : ""}
              </p>
              <h1>{heading.title}</h1>
              <p className="live-deck">{heading.deck}</p>
              {words.locale !== "en" && !translatedHeadings[area] && (
                <p className="!mt-4 text-[15px] text-[#68715f]">{words.shell.roomInEnglish}</p>
              )}
            </div>
            <div className="live-head-actions">
              {primary &&
                ((isOwner && area !== "mine") ||
                (data.canCoordinate && area === "commitments") ||
                area === "time-off") && (
                <Button onClick={() => open(primary)}>
                  <Plus size={17} aria-hidden="true" />
                  {actions[primary] ?? actionTitles[primary]}
                </Button>
              )}
              {headAction && (
                <Button
                  variant={headAction.quiet ? "outline" : "default"}
                  onClick={headAction.run}
                >
                  {headAction.plus && <Plus size={17} aria-hidden="true" />}
                  {headAction.label}
                </Button>
              )}
            </div>
          </div>
          {data.truncated.length > 0 && (
            <div className="live-note">
              {words.shell.limited}
            </div>
          )}
          {error && (
            <div className="live-error" role="alert">
              {error}
            </div>
          )}
          {invitationLink && (
            <div className="live-success">
              <p>
                {invitationDelivery === "queued"
                  ? "Invitation created and email queued."
                  : "Invitation created. No email was sent."}{" "}
                Share this private link with the invited person:
              </p>
              <Input
                readOnly
                aria-label="Private invitation link"
                value={invitationLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInvitationLink("")}
              >
                Dismiss
              </Button>
            </div>
          )}
          {notice && (
            <div className="live-success" role="status" tabIndex={-1} ref={outcomeNotice}>
              {notice}
            </div>
          )}
          <div className="live-room" key={area}>
            <Section />
            {pagination}
          </div>
        </main>
      </div>
      <div className="paper-wave" aria-hidden="true" ref={waveRef}>
        {["#365c46", "#6f5f93", "#f7f4ed"].map((fill, sheet) => (
          <svg key={fill} viewBox="0 0 100 100" preserveAspectRatio="none">
            <path fill={fill} d={["M0 9C18 1 34 13 53 7S84 0 100 8V100H0Z", "M0 5C22 12 40 0 60 6S88 12 100 4V100H0Z", "M0 10C16 3 38 9 56 4S86 11 100 6V100H0Z"][sheet]} />
          </svg>
        ))}
      </div>
          <LiveDialog
            open={dialog !== null}
            onClose={() => {
              if (!pending) setDialog(null);
            }}
            title={dialog && (actions[dialog] ?? actionTitles[dialog])}
            description={<>{dialog === "invite"
                    ? "They’ll choose to join your private group workspace."
                    : dialog === "commitment" || dialog === "meeting"
                      ? `Times are in ${data.church.timeZone}.`
                      : "Make the next step clear for your team."}</>}
          >
              {dialog === "timeOff" ? (
                <LiveTimeOffForm
                  data={data}
                  onSaved={() => {
                    setDialog(null);
                    setNotice(
                      words.timeOffForm.saved,
                    );
                  }}
                />
              ) : (
                dialog && (
                  <LiveCreateForm
                    kind={dialog}
                    data={data}
                    pending={pending}
                    error={error}
                    onSubmit={async (command) => {
                      if (await perform(command, "Saved.")) setDialog(null);
                    }}
                  />
                )
              )}
          </LiveDialog>
          <PaperSurface
            title={selected?.title ?? words.detail.fallbackTitle}
            variant="workspace"
            returnFocusRef={commitmentTrigger}
            open={!!selected}
            onOpenChange={(value) => {
              if (!value && !pending) setSelectedCommitment(null);
            }}
          >
        <CommitmentDetail
          selected={selected}
          error={error}
          onEdit={(item) => {
            setEditingCommitment(item);
            setSelectedCommitment(null);
            setError("");
          }}
          onRelease={(item) => {
            setSelectedCommitment(null);
            setRelease(item);
          }}
          onClose={() => setSelectedCommitment(null)}
        />
        </PaperSurface>
        <LiveDialog
          open={editingCommitment !== null}
          onClose={() => {
            if (!pending) setEditingCommitment(null);
          }}
          title={<>Edit commitment</>}
          description={<>Times use {data.church.timeZone}. You’ll review the changes before
                saving.</>}
        >
            {editingCommitment && (
              <LiveCommitmentEditor
                key={editingCommitment.id + ":" + editingCommitment.version}
                item={editingCommitment}
                timeZone={data.church.timeZone}
                pending={pending}
                error={error}
                save={async (command) => {
                  if (
                    await perform(
                      command,
                      "Commitment updated. Material changes require a new acceptance.",
                    )
                  )
                    setEditingCommitment(null);
                }}
              />
            )}
        </LiveDialog>
        <LiveDialog
          open={confirmation !== null}
          onClose={() => {
            if (!pending) setConfirmation(null);
          }}
          title={confirmation?.title}
          description={confirmation?.body}
        >
            {error && (
              <div className="live-error" role="alert">
                {error}
              </div>
            )}
            <div className="live-form-actions">
              <Button
                variant="outline"
                onClick={() => setConfirmation(null)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                disabled={pending}
                onClick={async () => {
                  if (
                    confirmation &&
                    (await perform(confirmation.command, "Updated."))
                  )
                    setConfirmation(null);
                }}
              >
                Confirm
              </Button>
            </div>
        </LiveDialog>
        <LiveDialog
          open={!!release}
          onClose={() => {
            if (!pending) setRelease(null);
          }}
          title={words.detail.changeTitle}
          description={<>{release &&
                  `${release.title} · ${when(release.start, release.end)}`}</>}
        >
            <p>
              This releases this date only. Your other commitments and your place
              on the team stay the same. The date will need cover.
            </p>
            {error && (
              <div className="live-error" role="alert">
                {error}
              </div>
            )}
            <div className="live-form-actions">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setRelease(null)}
              >
                Keep commitment
              </Button>
              <Button
                disabled={pending}
                onClick={async () => {
                  if (
                    release &&
                    (await perform(
                      {
                        type: "release",
                        commitmentId: release.id,
                        expectedVersion: release.version,
                      },
                      words.detail.released,
                    ))
                  )
                    setRelease(null);
                }}
              >
                Confirm change
              </Button>
            </div>
        </LiveDialog>
      </div>
    </WorkspaceProvider>
  );
}

/** Where the menu's marker last sat, so it can slide from the room just left even though the page is new. */
let lastMarker: Record<string, string> | null = null;

/** Lays the marker under the current room's line and slides it there from where it was. */
function useNavMarker(area: LiveArea) {
  const nav = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = nav.current;
    const marker = element?.querySelector<HTMLElement>(".live-nav-marker");
    if (!element || !marker) return;
    const place = (slide: boolean) => {
      const current = element.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!current) return;
      const next = {
        "--marker-x": `${current.offsetLeft}px`,
        "--marker-y": `${current.offsetTop}px`,
        "--marker-w": `${current.offsetWidth}px`,
        "--marker-h": `${current.offsetHeight}px`,
      };
      if (slide && lastMarker) {
        delete marker.dataset.sliding;
        for (const [name, value] of Object.entries(lastMarker)) marker.style.setProperty(name, value);
        void marker.offsetWidth;
        marker.dataset.sliding = "";
      }
      for (const [name, value] of Object.entries(next)) marker.style.setProperty(name, value);
      lastMarker = next;
      // In the sideways row of an upright tablet, bring the current room into view.
      if (element.scrollWidth > element.clientWidth)
        element.scrollLeft = current.offsetLeft - (element.clientWidth - current.offsetWidth) / 2;
    };
    place(true);
    const resized = new ResizeObserver(() => {
      delete marker.dataset.sliding;
      place(false);
    });
    resized.observe(element);
    return () => resized.disconnect();
  }, [area]);
  return nav;
}

/** Once a session, on the first room after sign-in or the sample link, the paper sweeps up and settles as the page. */
function useArrival() {
  const wave = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = wave.current;
    const app = element?.closest<HTMLElement>(".live-app");
    if (!element || !app) return;
    try {
      // The sheet carried over from the home page is its own arrival.
      if (sessionStorage.getItem("kind-helps-arrived") || sessionStorage.getItem("neighborly-paper")) return;
      sessionStorage.setItem("kind-helps-arrived", "1");
    } catch {
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.dataset.playing = "";
    app.dataset.arriving = "";
    const done = window.setTimeout(() => {
      delete element.dataset.playing;
      delete app.dataset.arriving;
    }, 1200);
    return () => {
      window.clearTimeout(done);
      delete element.dataset.playing;
      delete app.dataset.arriving;
    };
  }, []);
  return wave;
}

/**
 * On iPhone and iPad the app follows the system's text size (Settings, Larger Text), up to 130%.
 * The system's body size is read from a probe set in `-apple-system-body`, which is 17px at the
 * standard setting, and every size in the app is scaled by the same share. Elsewhere nothing changes.
 */
function useSystemTextSize() {
  useEffect(() => {
    if (!CSS.supports("font", "-apple-system-body")) return;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;font:-apple-system-body;-webkit-text-size-adjust:100%";
    document.body.append(probe);
    const root = document.documentElement.style;
    const fit = () => {
      const share = Math.min(1.3, Math.max(1, parseFloat(getComputedStyle(probe).fontSize) / 17));
      root.setProperty("-webkit-text-size-adjust", `${Math.round(share * 100)}%`);
    };
    fit();
    // The setting can change while the app is in the background.
    document.addEventListener("visibilitychange", fit);
    return () => {
      document.removeEventListener("visibilitychange", fit);
      root.removeProperty("-webkit-text-size-adjust");
      probe.remove();
    };
  }, []);
}
