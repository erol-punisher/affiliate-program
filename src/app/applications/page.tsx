import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ApplicationsBoard } from "@/components/ApplicationsBoard";

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <ApplicationsBoard userEmail={session.email} />;
}
