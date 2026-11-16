import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { RequestForQueries } from "convex/react";
import { renderHook } from "@testing-library/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDashboard } from "./dashboard";

/** Every object the room hands to useQueries, in order, and what the backend answers for each conference. */
const asked: RequestForQueries[] = [];
const rooms = new Map<string | undefined, { church: { id: string } }>();
mock.module("convex/react", () => ({
  useQueries: (queries: RequestForQueries) => {
    asked.push(queries);
    const request = queries.dashboard;
    return request ? { dashboard: rooms.get((request.args as { churchId?: string }).churchId) } : {};
  },
}));

const first = "church_first" as Id<"churches">;
const second = "church_second" as Id<"churches">;
const argsAsked = () => asked.map((queries) => queries.dashboard?.args);

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  asked.length = 0;
  rooms.clear();
  rooms.set(first, { church: { id: first } });
  rooms.set(second, { church: { id: second } });
  rooms.set(undefined, { church: { id: "church_sample" } });
  window.localStorage.clear();
});

type Props = Parameters<typeof useDashboard>[0];
const member: Props = { churchId: first, enterSample: false, ready: true, listing: false, sampleVisitor: false };

describe("the room's dashboard", () => {
  test("a member with two conferences gets the selected one, and switching gets the other", () => {
    const { result, rerender } = renderHook((props: Props) => useDashboard(props), { initialProps: member });
    expect(result.current?.church.id).toBe(first);
    rerender({ ...member, churchId: second });
    expect(result.current?.church.id).toBe(second);
    expect(argsAsked().at(-1)).toEqual({ churchId: second });
  });

  test("a member who did not press the sample link never asks without naming a conference", () => {
    const { rerender } = renderHook((props: Props) => useDashboard(props), {
      initialProps: { ...member, churchId: undefined, ready: false, listing: true } as Props,
    });
    rerender({ ...member, churchId: undefined, listing: true });
    rerender(member);
    rerender({ ...member, churchId: second });
    expect(argsAsked().some((args) => args !== undefined && !("churchId" in args))).toBe(false);
  });

  test("through the sample door the room is asked once, without a conference, and kept that way", () => {
    const visitor: Props = { churchId: undefined, enterSample: true, ready: true, listing: true, sampleVisitor: undefined };
    const { result, rerender } = renderHook((props: Props) => useDashboard(props), { initialProps: visitor as Props });
    rerender({ ...visitor, churchId: "church_sample" as Id<"churches">, listing: false, sampleVisitor: true });
    expect(result.current?.church.id).toBe("church_sample" as Id<"churches">);
    expect(new Set(argsAsked().map((args) => JSON.stringify(args)))).toEqual(new Set(["{}"]));
  });

  test("the question is the same object across renders until it really changes (no render loop, React #301)", () => {
    const { rerender } = renderHook((props: Props) => useDashboard(props), { initialProps: member });
    rerender(member);
    rerender({ ...member, sampleVisitor: false });
    expect(new Set(asked).size).toBe(1);
    rerender({ ...member, churchId: second });
    expect(new Set(asked).size).toBe(2);
  });
});
