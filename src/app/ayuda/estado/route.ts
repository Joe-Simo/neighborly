import { showStatus } from "@/lib/help-page/handle";

export function GET(request: Request) {
  return showStatus("es", request);
}
export function POST(request: Request) {
  return showStatus("es", request);
}
