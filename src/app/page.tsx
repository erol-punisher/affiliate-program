import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Dashboard } from "@/components/Dashboard";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <Dashboard userEmail={session.email} />;
}
