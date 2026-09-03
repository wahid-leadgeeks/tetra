import { NextResponse } from "next/server";
import { getAuthContext, unauthorized } from "@/features/activities/api";
import { listCategories } from "@/features/activities/service";

/** GET /api/categories — all categories ordered by sortOrder. */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  const categories = await listCategories();
  return NextResponse.json(categories);
}
