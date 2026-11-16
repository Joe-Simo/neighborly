import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";
import { errorButton } from "./error-button";

test("the root error page's button is the standard button", () => {
  expect(renderToStaticMarkup(<button {...errorButton}>Try again</button>)).toBe(renderToStaticMarkup(<Button>Try again</Button>));
});
