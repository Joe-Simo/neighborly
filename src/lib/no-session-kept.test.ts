import { expect, test } from "bun:test";
import { noSessionKept } from "./no-session-kept";

test("a browser that never signed in, or has signed out, cannot be signed in", () => {
  expect(noSessionKept("")).toBe(true);
  expect(noSessionKept("theme=light; __clerk_db_jwt=dvb_x")).toBe(true);
  expect(noSessionKept("__client_uat=0; __client_uat_Ab12Cd34=0; __clerk_db_jwt=dvb_x; __clerk_db_jwt_Ab12Cd34=dvb_x")).toBe(true);
});

test("a token or a sign-in time, under either name, leaves the question to Clerk", () => {
  expect(noSessionKept("__session=eyJ")).toBe(false);
  expect(noSessionKept("a=b; __session_Ab12Cd34=eyJ; __client_uat=0")).toBe(false);
  expect(noSessionKept("__client_uat=1763400000")).toBe(false);
  expect(noSessionKept("__client_uat=0; __client_uat_Ab12Cd34=1763400000")).toBe(false);
  expect(noSessionKept("__client_uat=")).toBe(false);
});
