import { notFound } from "next/navigation";
import { ClientApp } from "@/components/ClientApp";

// The reader is one client app; this route only exists so /automate/<section> URLs load it
// directly. AppShell reads the section from the path.
export function generateStaticParams() {
  return [{ section: "rules" }, { section: "filters" }];
}

export default async function AutomatePage({
  params,
}: PageProps<"/automate/[section]">) {
  const { section } = await params;
  if (section !== "rules" && section !== "filters") notFound();
  return <ClientApp />;
}
