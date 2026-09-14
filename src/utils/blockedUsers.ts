import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { datingApi } from '../api/dating';

/** A row of `GET /blocks` — someone the signed-in user has blocked. */
export interface BlockedUser {
  blockedId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  blockedAt: string;
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
    try {
      const res = await datingApi.getBlocks();
      setBlocked(res.data?.data ?? []);
    } catch {
      // Keep the last known list rather than falling back to an empty one —
      // a failed refresh must not make blocked people reappear mid-session.
    } finally {
      setLoaded(true);
    }
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
