import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TemplatesBoard } from "@/components/TemplatesBoard";

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <TemplatesBoard userEmail={session.email} />;
}
