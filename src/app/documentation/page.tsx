import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DocumentationBoard } from "@/components/DocumentationBoard";

export default async function DocumentationPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <DocumentationBoard userEmail={session.email} />;
}
