import { convexAuthNextjsProxy } from "@/lib/convexAuth";
export default convexAuthNextjsProxy(async () => {});
export const config = { matcher: ["/((?!auth(?:/|$)|calendar/|_next/static|_next/image|favicon.ico).*)"] };
