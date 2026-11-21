import { showForm, takeStep } from "@/lib/help-page/handle";

// Plain HTML with a form that posts without script: see src/lib/help-page and app-load's budget (100 KB, 0 KB of JS).
export function GET(request: Request) {
  return showForm("en", request);
}
export function POST(request: Request) {
  return takeStep("en", request);
}
