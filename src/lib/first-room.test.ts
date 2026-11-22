import { afterAll, beforeAll, expect, mock, spyOn, test } from "bun:test";

const said = spyOn(console, "error");
const warned = spyOn(console, "warn");
let asked = 0;
// Any reference will do: the client is mocked and refuses.
const reference = async () => ({}) as never;

beforeAll(() => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  // The backend rations the public answer: the request is refused, as a 429 is.
  mock.module("convex/browser", () => ({
    ConvexHttpClient: class {
      query() {
        asked += 1;
        return Promise.reject(new Error("429 Too Many Requests"));
      }
    },
  }));
});
afterAll(() => mock.restore());

test("a refused first-room request gives no look, says nothing and is not asked again: the sample opens the ordinary way", async () => {
  const { askFirstRoom, firstRoom, firstRoomHere } = await import("./first-room");
  expect(firstRoom()).toBeUndefined();
  askFirstRoom(reference);
  // No answer is no room: LiveRooms then takes the door's ordinary entry (`noLook` in live-app.tsx), with nothing of a look drawn.
  expect(await firstRoom()).toBeNull();
  askFirstRoom(reference);
  expect(await firstRoom()).toBeNull();
  expect(asked).toBe(1);
  // In hand it is null for this hour, and an answer from an earlier hour is never handed over to be drawn.
  expect(firstRoomHere()).toBeNull();
  const now = spyOn(Date, "now").mockReturnValue(Date.now() + 3_600_000);
  expect(firstRoomHere()).toBeUndefined();
  now.mockRestore();
  expect(said).not.toHaveBeenCalled();
  expect(warned).not.toHaveBeenCalled();
});
