import { notFound } from "next/navigation";
import { ClientApp } from "@/components/ClientApp";

const SECTIONS = ["general", "ai", "notifications", "import", "shortcuts"];

// Like /automate, this route only exists so /settings/<section> URLs load the client app directly.
export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export default async function SettingsRoute({
  params,
}: PageProps<"/settings/[section]">) {
  const { section } = await params;
  if (!SECTIONS.includes(section)) notFound();
  return <ClientApp />;
}
