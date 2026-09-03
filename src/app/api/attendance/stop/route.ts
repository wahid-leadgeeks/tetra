import { postAttendance } from "@/features/attendance/http";
import { clockOut } from "@/features/attendance/service";

/** POST /api/attendance/stop — clock out the open attendance. */
export async function POST(req: Request): Promise<Response> {
  return postAttendance(req, clockOut);
}
