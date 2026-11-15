import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { stateWords } from "./failure";
import { LiveFailure, LiveState } from "./states";

// Sign-in, welcome and the sample's resetting page draw these with no workspace shell around them.
describe("the states family outside the shell", () => {
  test("a failed save speaks English and does not throw", () => {
    const page = renderToStaticMarkup(<LiveFailure message="That code has expired." retry />);
    expect(page).toContain("That code has expired.");
    expect(page).toContain(stateWords.kept);
    expect(page).toContain(stateWords.tryAgain);
  });
  test("a state block stands without a room's mark", () => {
    const page = renderToStaticMarkup(
      <LiveState kind="missing" title={stateWords.missingTitle}>
        {stateWords.missingDeck}
      </LiveState>,
    );
    expect(page).toContain("This page isn");
    expect(page).not.toContain("paper-vignette");
  });
});
