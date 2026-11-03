import { NextResponse } from "next/server";
import { CensusError, zipSchema } from "@/lib/census";
import { fetchNeighborhood } from "@/lib/census-server";

export async function GET(req: Request) {
  const zip = zipSchema.safeParse(new URL(req.url).searchParams.get("zip") ?? "");
  if (!zip.success) return NextResponse.json({ error: "Enter a 5-digit ZIP code." }, { status: 400 });
  try {
    const data = await fetchNeighborhood(zip.data);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (e) {
    if (e instanceof CensusError) return NextResponse.json({ error: e.message }, { status: e.code === "not-found" ? 404 : 502 });
    return NextResponse.json({ error: "Could not load Census data." }, { status: 502 });
  }
}
