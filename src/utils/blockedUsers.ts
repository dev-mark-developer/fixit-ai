import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { datingApi } from '../api/dating';
import type { DatingMatch } from '../api/dating';
import { parseApiDate } from './datetime';

/** A row of `GET /blocks` — someone the signed-in user has blocked. */
export interface BlockedUser {
  blockedId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  blockedAt: string;
}

/**
 * The last list loaded, for code that runs outside a screen — the push
 * handlers check it so a blocked person's messages don't pop up while the app
 * is open. Loaded at sign-in (MainNavigator) and on every screen refresh.
 */
let latestBlockedIds = new Set<number>();

export function isBlockedUser(userId: number): boolean {
  return latestBlockedIds.has(userId);
}

/**
 * `GET /blocks`, remembered for {@link isBlockedUser}. Null when the request
 * failed — the last known list is kept rather than emptied, so a failed
 * refresh can't make blocked people reappear mid-session.
 */
export async function loadBlockedUsers(): Promise<BlockedUser[] | null> {
  try {
    const res = await datingApi.getBlocks();
    const rows: BlockedUser[] = res.data?.data ?? [];
    latestBlockedIds = new Set(rows.map((b) => b.blockedId));
    return rows;
  } catch {
    return null;
  }
}

/** On sign-out, so the next account doesn't inherit this one's list. */
export function clearBlockedUsers(): void {
  latestBlockedIds = new Set();
}

/**
 * Everyone the signed-in user has blocked, refreshed each time the screen
 * comes into focus (so it is current straight after a block, which navigates
 * back into one of these lists).
 *
 * The API already keeps blocked people out of Likes Received and My Likes, but
 * **not** out of `GET /dating/matches` — QA found blocked users still sitting
 * in Matches with a live chat. Until the endpoint filters them (gap #29), the
 * app does it here, from the one list that says who is blocked.
 *
 * Note this only covers people *this* user blocked. Being blocked *by* someone
 * else is invisible to the client and has to be enforced server-side.
 */
export function useBlockedUsers() {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await loadBlockedUsers();
    // On failure keep the last known list rather than falling back to an
    // empty one — a failed refresh must not make blocked people reappear.
    if (rows) setBlocked(rows);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const blockedIds = useMemo(
    () => new Set(blocked.map((b) => b.blockedId)),
    [blocked],
  );

  return { blocked, blockedIds, loaded, refresh };
}

/**
 * A match's block state, both ways. `GET /dating/matches` now carries
 * `isBlockedByMe` / `hasBlockedMe` (gap #29); the user's own `GET /blocks`
 * list still counts too, so a block shows straight away even before the
 * matches have been reloaded.
 */
export function matchBlockState(
  match: Pick<DatingMatch, 'otherUserId' | 'isBlockedByMe' | 'hasBlockedMe'>,
  blockedIds: ReadonlySet<number>,
): { blockedByMe: boolean; blockedMe: boolean } {
  return {
    blockedByMe: match.isBlockedByMe === true || blockedIds.has(match.otherUserId),
    blockedMe: match.hasBlockedMe === true,
  };
}

/**
 * Whether a chat message should be hidden: sent by someone the user has
 * blocked, after the block. The backend still delivers those (gap #29), but
 * the history from before the block stays readable. A block without a
 * readable time hides nothing, rather than guessing.
 */
export function isAfterBlock(
  message: { senderId: number; sentAt: string },
  block: Pick<BlockedUser, 'blockedId' | 'blockedAt'> | undefined,
): boolean {
  if (!block || message.senderId !== block.blockedId) return false;
  const blockedAt = parseApiDate(block.blockedAt).getTime();
  if (Number.isNaN(blockedAt)) return false;
  return parseApiDate(message.sentAt).getTime() > blockedAt;
}
