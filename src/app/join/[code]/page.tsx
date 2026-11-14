import { notFound, redirect } from "next/navigation";
import { findByInviteCode } from "@/lib/queries";

/** Short invite links: /join/<code> works for both challenges and teams. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const hit = findByInviteCode(code);
  if (!hit) notFound();
  redirect(`/${hit.kind === "challenge" ? "c" : "t"}/${hit.slug}?k=${code}`);
}
