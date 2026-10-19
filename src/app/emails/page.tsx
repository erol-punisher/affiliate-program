import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { EmailsBoard } from "@/components/EmailsBoard";

export default async function Emails() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <EmailsBoard userEmail={session.email} />;
}
