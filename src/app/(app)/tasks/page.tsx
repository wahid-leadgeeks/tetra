import { auth } from "@/server/auth";
import { TasksView } from "@/components/tasks/tasks-view";

const FALLBACK_TIMEZONE = "Asia/Jakarta";

export const metadata = {
  title: "Tasks — TETRA",
};

export default async function TasksPage() {
  const session = await auth();
  const timeZone = session?.user?.timezone ?? FALLBACK_TIMEZONE;

  return <TasksView timeZone={timeZone} />;
}
