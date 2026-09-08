import { NextResponse } from "next/server";
import { getAuthContext, unauthorized } from "@/features/activities/api";
import { listCategories } from "@/features/activities/service";

/** GET /api/categories — all categories ordered by sortOrder. */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  try {
    const categories = await listCategories();
    return NextResponse.json(categories);
  } catch (err) {
    console.error("Failed to list categories:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load categories" },
      { status: 500 },
    );
  }
}
