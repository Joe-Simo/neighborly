"use client";

import { Component, createContext, type ReactNode } from "react";
import { ConvexError } from "convex/values";

/** What access.ts says when the caller has no account row. */
const noAccount = (error: unknown) => error instanceof ConvexError && error.data === "Sign in required.";
/** Whether the note's word is taken. It is, until rooms asked for on it have failed. */
export const NoteTrusted = createContext(true);
/**
 * The browser's note of the account the backend last found here (live-providers.tsx) can be wrong: the row it remembers may be gone. The rooms asked for on its word then fail with "no
 * account". That is not shown. The note's word is dropped and the app starts over in the first-visit order, under the
 * same waiting picture: the account check makes the row, then the rooms are asked. Any other failure, and this one
 * once the note is no longer trusted, goes on to the error page as before.
 */
export class AskedTooSoon extends Component<{ children: ReactNode }, { trusted: boolean; failure: unknown }> {
  state = { trusted: true, failure: null as unknown };
  static getDerivedStateFromError(failure: unknown) {
    return { failure };
  }
  static getDerivedStateFromProps(_: unknown, state: { trusted: boolean; failure: unknown }) {
    return state.trusted && noAccount(state.failure) ? { trusted: false, failure: null } : null;
  }
  render() {
    if (this.state.failure) throw this.state.failure;
    return <NoteTrusted value={this.state.trusted}>{this.props.children}</NoteTrusted>;
  }
}
