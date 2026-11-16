"use client";

import { useContext } from "react";
import * as live from "convex/react";
import type { OptionalRestArgsOrSkip, PaginatedQueryArgs, PaginatedQueryReference, UsePaginatedQueryReturnType } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import * as kept from "convex-helpers/react/cache/hooks";
import { ConvexQueryCacheContext } from "convex-helpers/react/cache/provider";

/**
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
  return source.useQuery(query, ...args);
}

export function usePaginatedQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  options: { initialNumItems: number },
): UsePaginatedQueryReturnType<Query> {
  const source = useContext(ConvexQueryCacheContext).registry ? kept : live;
  return source.usePaginatedQuery(query, args, options);
}
