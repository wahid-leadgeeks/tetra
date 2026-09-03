import { postAttendance } from "@/features/attendance/http";
import { startBreak } from "@/features/attendance/service";

/** POST /api/breaks/start — start a break on the open attendance. */
export async function POST(req: Request): Promise<Response> {
  return postAttendance(req, startBreak);
}
