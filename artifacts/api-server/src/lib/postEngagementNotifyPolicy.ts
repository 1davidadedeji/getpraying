import { isSeedUserId } from "./seedUsers";

export const PRAYER_MILESTONES = [5, 10, 25, 50, 100, 250, 500] as const;

export async function shouldNotifyPostAuthor(
  authorId: number | null | undefined,
  actorId: number,
): Promise<boolean> {
  if (!authorId || authorId === actorId) return false;
  return !(await isSeedUserId(authorId));
}
