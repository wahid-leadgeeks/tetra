import { postAttendance } from "@/features/attendance/http";
import { clockIn } from "@/features/attendance/service";

/** POST /api/attendance/start — clock in for today. */
export async function POST(req: Request): Promise<Response> {
  return postAttendance(req, clockIn);
}
