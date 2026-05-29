import { redirect } from "next/navigation";

/** Library paths are fixed (12 categories from seed) — staff add guides under each path. */
export default function NewPathPage() {
  redirect("/dashboard/paths");
}
