import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CrmAnalyticsBoard } from "@/components/CrmAnalyticsBoard";

export default async function CrmAnalytics() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <CrmAnalyticsBoard userEmail={session.email} />;
}
