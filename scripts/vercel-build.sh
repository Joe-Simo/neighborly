#!/bin/sh
# Vercel's build for the live site: the backend goes out first, then the website, in one step,
# so a screen can never be live ahead of the functions it calls.
# It stops before anything changes if the backend deploy would delete an index.
set -e

plan=$(bunx convex deploy --dry-run -y 2>&1) || { echo "$plan"; echo "Stopping: the backend deploy would not go through."; exit 1; }
echo "$plan"
if ! echo "$plan" | grep -q "No indexes are deleted by this push"; then
  echo "Stopping: this deploy would delete an index. Deploy it by hand after checking."
  exit 1
fi

bunx convex deploy -y --cmd "bun run build"
