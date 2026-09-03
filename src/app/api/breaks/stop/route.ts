import { postAttendance } from "@/features/attendance/http";
import { endBreak } from "@/features/attendance/service";

/** POST /api/breaks/stop — end the open break. */
export async function POST(req: Request): Promise<Response> {
  return postAttendance(req, endBreak);
}
