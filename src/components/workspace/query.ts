"use client";

import { useContext, useSyncExternalStore } from "react";
import * as live from "convex/react";
import type { OptionalRestArgsOrSkip, PaginatedQueryArgs, PaginatedQueryReference, UsePaginatedQueryReturnType } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import * as kept from "convex-helpers/react/cache/hooks";
import { ConvexQueryCacheContext } from "convex-helpers/react/cache/provider";
import { useFirstLook } from "@/components/workspace/first-look";

/**
 * In a first look at the sample (first-look.tsx) nothing is asked at all: the rows there carry seed keys, not ids.
 * How every room reads. Inside the app (LiveProviders) a reading is kept for five minutes after its
 * room is left, so going back shows the room at once while it refreshes. Anywhere the keeping
 * provider is absent, a picture harness or a test, the same call reads straight from Convex, so a
 * room opens with nothing more than a ConvexProvider around it.
 * The provider sits above a whole tree, so one mounted component always takes the same path.
 */
export function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const source = useContext(ConvexQueryCacheContext).registry ? kept : live;
  const look = useFirstLook();
  const asked = source.useQuery(query, ...(look ? (["skip"] as OptionalRestArgsOrSkip<Query>) : args));
  // In a look at a kept room other than the week, the reading it kept is the answer; anything else waits.
  return look ? (keptAnswer(look.answers, query) as FunctionReturnType<Query> | undefined) : asked;
}

/** A reading kept on the device for a first look (lib/kept-room.ts), by the reading's name. */
export function keptAnswer(answers: Record<string, unknown> | undefined, query: FunctionReference<"query">) {
  return answers?.[getFunctionName(query)];
}

export function usePaginatedQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  options: { initialNumItems: number },
): UsePaginatedQueryReturnType<Query> {
  const source = useContext(ConvexQueryCacheContext).registry ? kept : live;
  const looking = useFirstLook() !== null;
  return source.usePaginatedQuery(query, looking ? "skip" : args, options);
}

const HOUR = 3_600_000;
const thisHour = () => Math.floor(Date.now() / HOUR) * HOUR;
function onTheHour(changed: () => void) {
  // A page left in the background asks nothing new; it catches up the moment it is looked at again.
  const seen = () => document.visibilityState === "visible" && changed();
  let timer: ReturnType<typeof setTimeout>;
  const wait = () => {
    timer = setTimeout(() => {
      seen();
      wait();
    }, thisHour() + HOUR - Date.now());
  };
  wait();
  document.addEventListener("visibilitychange", seen);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", seen);
  };
}

/**
 * The start of the present hour, for a reading that depends on the time. The backend never reads the
 * clock in a query (see `hour` in convex/access.ts): the room hands it this, so everyone looking in
 * the same hour shares one answer and a page left open is not added up again every minute.
 * 0 on the server, where there is no present hour: ask nothing until it is known.
 */
export function useHour() {
  return useSyncExternalStore(onTheHour, thisHour, () => 0);
}
