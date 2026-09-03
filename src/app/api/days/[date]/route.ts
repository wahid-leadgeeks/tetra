import { NextResponse } from "next/server";
import { z } from "zod";
import { getDaySummary } from "@/features/daily-summary/service";
import { auth } from "@/server/auth";

const dateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Invalid date");

const sessionUserSchema = z.object({
  id: z.string().min(1),
  timezone: z.string().min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const parsedDate = dateParamSchema.safeParse(date);
  if (!parsedDate.success) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const session = await auth();
  const parsedUser = sessionUserSchema.safeParse(session?.user);
  if (!parsedUser.success) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getDaySummary(
    parsedUser.data.id,
    parsedDate.data,
    parsedUser.data.timezone,
  );
  return NextResponse.json(summary);
}
