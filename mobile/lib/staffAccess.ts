import type { User } from "@workspace/api-client-react";

/** Admins and moderators bypass subscription gates and get full premium features. */
export function isStaffUser(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "moderator";
}
