import type { Infer } from "convex/values";
import type { serviceArea } from "./schema";

/**
 * Where a team helps, and the one routing rule: a request goes to the team whose area holds the sender's zip centre;
 * where areas overlap, the team whose church is nearest wins. Areas are GeoJSON (Polygon or MultiPolygon, WGS84). The
 * settings make a circle polygon from a zip and miles; anything that writes a valid polygon (a map, a parish boundary)
 * routes the same way. Small and dependency-free on purpose: it runs on the server and adds nothing to any page.
 */
export type Area = Infer<typeof serviceArea>;
export type Point = { lat: number; lng: number };
/** The radius choices a team picks from once; any whole number of miles in this range may be typed instead. */
export const RADIUS_CHOICES = { city: 5, suburb: 10, rural: 25 } as const;
export const MIN_MILES = 1;
export const MAX_MILES = 100;
export const MAX_VERTICES = 5000;
const CIRCLE_STEPS = 64;

const EARTH_MILES = 3958.8;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Great-circle (haversine) distance in miles. */
export function distanceMiles(a: Point, b: Point) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A circle of `miles` around `center` as a closed 64-step polygon (destination points along each bearing). */
export function circlePolygon(center: Point, miles: number): Area {
  const d = miles / EARTH_MILES, lat1 = rad(center.lat), lng1 = rad(center.lng);
  const ring: number[][] = [];
  for (let step = 0; step < CIRCLE_STEPS; step++) {
    const bearing = (2 * Math.PI * step) / CIRCLE_STEPS;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([Number(deg(lng2).toFixed(6)), Number(deg(lat2).toFixed(6))]);
  }
  ring.push([...ring[0]]);
  return { type: "Polygon", coordinates: [ring] };
}

const polygons = (area: Area): number[][][][] => (area.type === "Polygon" ? [area.coordinates] : area.coordinates);

/** Closed rings of at least four positions, real coordinates, and no more than MAX_VERTICES in all. */
export function validArea(area: Area) {
  let count = 0;
  for (const polygon of polygons(area)) {
    if (!polygon.length) return false;
    for (const ring of polygon) {
      if (ring.length < 4) return false;
      const [first, last] = [ring[0], ring[ring.length - 1]];
      if (first[0] !== last[0] || first[1] !== last[1]) return false;
      for (const position of ring) {
        if (position.length < 2 || !Number.isFinite(position[0]) || !Number.isFinite(position[1]) || Math.abs(position[0]) > 180 || Math.abs(position[1]) > 90) return false;
      }
      count += ring.length;
    }
  }
  return count > 0 && count <= MAX_VERTICES;
}

/** Ray casting on one ring, [lng, lat] positions. */
function inRing(ring: number[][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Whether the area holds the point: inside a polygon's outer ring and outside its holes. */
export function covers(area: Area, point: Point) {
  return polygons(area).some(([outer, ...holes]) => inRing(outer, point.lng, point.lat) && !holes.some((hole) => inRing(hole, point.lng, point.lat)));
}

/** [west, south, east, north] of an area. */
export function bbox(area: Area) {
  const box = [180, 90, -180, -90];
  for (const polygon of polygons(area)) for (const [lng, lat] of polygon[0] ?? []) {
    box[0] = Math.min(box[0], lng); box[1] = Math.min(box[1], lat); box[2] = Math.max(box[2], lng); box[3] = Math.max(box[3], lat);
  }
  return box;
}
const inBox = (box: number[] | undefined, point: Point) => !box || box.length !== 4 || (point.lng >= box[0] && point.lat >= box[1] && point.lng <= box[2] && point.lat <= box[3]);

export type Team<Id> = { id: Id; area: Area; center: Point; bbox?: number[]; /** Lower wins where areas overlap, before distance. */ order?: number; /** The circle radius in miles, when the area is a circle. */ miles?: number };
/**
 * Every team that serves a point, best first: a set overlap order first (a council placing its conferences), then the
 * nearest church. `reachMiles` is the radius of the sender's zip's own land: when no area holds the zip's centre but a
 * circle comes within that reach, the team still serves it, marked to check (big rural zips whose centre is far off).
 */
export function covering<Id>(teams: Team<Id>[], point: Point, reachMiles = 0) {
  const rank = (team: Team<Id>) => ({ id: team.id, miles: distanceMiles(team.center, point), order: team.order ?? Number.MAX_SAFE_INTEGER });
  const sort = (a: ReturnType<typeof rank>, b: ReturnType<typeof rank>) => a.order - b.order || a.miles - b.miles;
  const inside = teams.filter((team) => inBox(team.bbox, point) && covers(team.area, point)).map(rank).sort(sort);
  if (inside.length || reachMiles <= 0) return inside.map((team) => ({ id: team.id, checkArea: false }));
  const near = teams.filter((team) => team.miles !== undefined && distanceMiles(team.center, point) <= (team.miles ?? 0) + reachMiles).map(rank).sort(sort);
  return near.map((team) => ({ id: team.id, checkArea: true }));
}
/** The radius of a circle with a zip's land area: how far its people may live from its centre. */
export const reachOf = (sqmi: number | undefined) => (sqmi && sqmi > 0 ? Math.sqrt(sqmi / Math.PI) : 0);
/** The one team that gets a point, or null: then no team serves that place yet. */
export function nearestCovering<Id>(teams: Team<Id>[], point: Point): Id | null {
  return covering(teams, point)[0]?.id ?? null;
}
/** Other teams by distance from a point, nearest first: where a request may be passed on. */
export function byDistance<Id>(teams: Team<Id>[], point: Point) {
  return teams.map((team) => ({ id: team.id, miles: distanceMiles(team.center, point) })).sort((a, b) => a.miles - b.miles);
}

export const validZip = (zip: string) => /^\d{5}$/.test(zip);
export const validMiles = (miles: number) => Number.isInteger(miles) && miles >= MIN_MILES && miles <= MAX_MILES;
