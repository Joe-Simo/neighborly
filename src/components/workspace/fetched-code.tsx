import { use, type ComponentType } from "react";

/**
 * A component whose code is fetched apart from the page's first load. `fetch` asks for it once (a failed fetch is
 * forgotten, so the next ask really fetches again). Once here, the promise is marked as React marks one it has read,
 * so `Code` draws it in its first frame; drawn sooner, `Code` waits for it (put it inside a Suspense).
 */
export function fetchedCode<P extends object>(load: () => Promise<ComponentType<P>>) {
  let asked: Promise<ComponentType<P>> | undefined;
  const fetch = () => {
    if (!asked) {
      const fetched = load().then(
        (code) => {
          Object.assign(fetched, { status: "fulfilled", value: code });
          return code;
        },
        (fault: unknown) => {
          if (asked === fetched) asked = undefined;
          throw fault;
        },
      );
      asked = fetched;
    }
    return asked;
  };
  function Code(props: P) {
    const Fetched = use(fetch());
    return <Fetched {...props} />;
  }
  return { fetch, Code };
}
