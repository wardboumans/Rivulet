import { json } from "@/lib/api";
import { getSidebar } from "@/lib/queries";

export function GET() {
  return json(getSidebar());
}
