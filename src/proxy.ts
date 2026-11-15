import { convexAuthNextjsProxy } from "@/lib/convexAuth";
export default convexAuthNextjsProxy(async () => {});
// Only the signed-in app needs its session refreshed before a page is served. The public pages,
// paintings, fonts and 3D files are served straight from the cache, with no function in front.
export const config = { matcher: ["/app", "/app/:path*"] };
