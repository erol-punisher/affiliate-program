import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PaymentRecords } from "@/components/PaymentRecords";

export default async function Payments() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <PaymentRecords userEmail={session.email} />;
}
