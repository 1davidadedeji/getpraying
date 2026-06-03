import { redirect } from "next/navigation";

/** Library paths are fixed (13 For your situation categories from seed) — staff add guides under each path. */
export default function NewPathPage() {
  redirect("/dashboard/paths");
}
