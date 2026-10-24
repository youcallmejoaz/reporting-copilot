import { redirect } from "next/navigation";
import { listProfileIds } from "@arc/core";

export const dynamic = "force-dynamic";

export default function ClientsIndex() {
  redirect(`/clients/${listProfileIds()[0]}`);
}
