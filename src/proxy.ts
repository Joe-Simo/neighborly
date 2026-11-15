import { convexAuthNextjsProxy } from "@/lib/convexAuth";
export default convexAuthNextjsProxy(async () => {});
export const config = { matcher: ["/((?!auth(?:/|$)|_next/static|_next/image|favicon.ico).*)"] };
