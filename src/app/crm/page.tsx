import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CrmBoard } from "@/components/CrmBoard";

export default async function Crm() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <CrmBoard userEmail={session.email} />;
}
