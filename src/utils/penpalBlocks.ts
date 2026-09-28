import AsyncStorage from '@react-native-async-storage/async-storage';
import { sharedApi } from '../api/shared';
import { penpalApi } from '../api/penpal';
import { loadBlockedUsers } from './blockedUsers';
import type { BlockedUser } from './blockedUsers';

/**
 * The penpal side of a connection, as much of it as the caller knows. Discover
 * rows and `/penpal/connections` rows both carry these, under the same names.
 */
export interface PenpalConnectionRef {
  connectionId?: number;
  status?: string;
  requesterId?: number;
}

/**
 * Blocks a penpal.
 *
 * `/blocks` is account-wide, but the Penpal endpoints don't honour it yet —
 * verified on beta 2026-09-26: after a block, both people still find each
 * other in discover and letters still go through in both directions. So the
 * connection is ended as well. Letters need an accepted connection, which makes
 * that the one thing the server *does* enforce today. Ending it can fail
 * without undoing the block — the lists hide the person either way.
 */
export async function blockPenpal(
  userId: number,
  pseudoName: string,
  profileImageUrl: string | undefined,
  myId: number | null,
  connection?: PenpalConnectionRef,
): Promise<void> {
  await sharedApi.block(userId);
  await rememberPseudonym(userId, pseudoName, profileImageUrl);

  const { connectionId, status, requesterId } = connection ?? {};
  if (connectionId !== undefined) {
    try {
      if (status === 'Accepted') {
        await penpalApi.removeConnection(connectionId);
      } else if (status === 'Pending') {
        if (requesterId === myId) await penpalApi.cancelConnection(connectionId);
        else await penpalApi.respondConnection(connectionId, 'Declined');
      }
    } catch {
      // Block stands; see above.
    }
  }

  // So push handling drops their notifications from now on, not from the next
  // screen refresh.
  await loadBlockedUsers();
}

// ── Pen names ────────────────────────────────────────────────────────────────

/**
 * `GET /blocks` returns the blocked person's real first and last name — even
 * for a penpal who chose to stay anonymous. The Penpal block list must show the
 * pen name the user knew them by instead, so it's remembered at block time.
 * Only on this device; a block made elsewhere falls back to the API's name.
 */
const PSEUDONYMS_KEY = 'penpal_blocked_pseudonyms';

type Pseudonyms = Record<string, { pseudoName: string; profileImageUrl?: string }>;

async function readPseudonyms(): Promise<Pseudonyms> {
  try {
    const raw = await AsyncStorage.getItem(PSEUDONYMS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function rememberPseudonym(
  userId: number,
  pseudoName: string,
  profileImageUrl?: string,
): Promise<void> {
  const all = await readPseudonyms();
  all[userId] = { pseudoName, profileImageUrl };
  await AsyncStorage.setItem(PSEUDONYMS_KEY, JSON.stringify(all)).catch(() => {});
}

export interface PenpalBlockedUser extends BlockedUser {
  /** Pen name if this device blocked them from Penpal, else the API's name. */
  displayName: string;
}

export async function withPseudonyms(rows: BlockedUser[]): Promise<PenpalBlockedUser[]> {
  const known = await readPseudonyms();
  return rows.map(b => {
    const pen = known[b.blockedId];
    return {
      ...b,
      displayName: pen?.pseudoName ?? `${b.firstName} ${b.lastName}`.trim(),
      profileImageUrl: pen ? pen.profileImageUrl : b.profileImageUrl,
    };
  });
}
