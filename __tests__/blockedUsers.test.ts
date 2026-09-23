jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

const mockGetBlocks = jest.fn();
jest.mock('../src/api/dating', () => ({
  datingApi: { getBlocks: () => mockGetBlocks() },
}));

import {
  clearBlockedUsers,
  isAfterBlock,
  isBlockedUser,
  loadBlockedUsers,
  matchBlockState,
} from '../src/utils/blockedUsers';

// As GET /blocks sends it: UTC, no zone marker
const BLOCK = { blockedId: 143, blockedAt: '2026-09-21T08:00:00' };

describe('isAfterBlock', () => {
  it('hides what the blocked person sends after the block', () => {
    // QA 2026-09-21: the blocked user kept sending, and the messages kept arriving.
    expect(isAfterBlock({ senderId: 143, sentAt: '2026-09-21T08:05:00Z' }, BLOCK)).toBe(true);
  });

  it('keeps the conversation from before the block readable', () => {
    expect(isAfterBlock({ senderId: 143, sentAt: '2026-09-21T07:59:59' }, BLOCK)).toBe(false);
  });

  it("never hides the user's own messages", () => {
    expect(isAfterBlock({ senderId: 7, sentAt: '2026-09-21T09:00:00Z' }, BLOCK)).toBe(false);
  });

  it('compares hub (…Z) and REST (zone-less) times as the same clock', () => {
    // Both are UTC; read naively, the zone-less one would shift by the
    // device's offset and misplace messages sent around the block.
    expect(isAfterBlock({ senderId: 143, sentAt: '2026-09-21T08:00:01' }, BLOCK)).toBe(true);
    expect(isAfterBlock({ senderId: 143, sentAt: '2026-09-21T08:00:01Z' }, BLOCK)).toBe(true);
  });

  it('hides nothing without a block, or with an unreadable block time', () => {
    expect(isAfterBlock({ senderId: 143, sentAt: '2026-09-21T09:00:00Z' }, undefined)).toBe(false);
    expect(
      isAfterBlock({ senderId: 143, sentAt: '2026-09-21T09:00:00Z' }, { blockedId: 143, blockedAt: '' }),
    ).toBe(false);
  });
});

describe('the shared blocked list', () => {
  beforeEach(() => {
    clearBlockedUsers();
    mockGetBlocks.mockReset();
  });

  it('answers isBlockedUser once loaded', async () => {
    mockGetBlocks.mockResolvedValue({ data: { data: [BLOCK] } });
    await loadBlockedUsers();
    expect(isBlockedUser(143)).toBe(true);
    expect(isBlockedUser(144)).toBe(false);
  });

  it('keeps the last list when a refresh fails', async () => {
    mockGetBlocks.mockResolvedValueOnce({ data: { data: [BLOCK] } });
    await loadBlockedUsers();
    mockGetBlocks.mockRejectedValueOnce(new Error('offline'));
    await expect(loadBlockedUsers()).resolves.toBeNull();
    expect(isBlockedUser(143)).toBe(true);
  });

  it('forgets everything on sign-out', async () => {
    mockGetBlocks.mockResolvedValue({ data: { data: [BLOCK] } });
    await loadBlockedUsers();
    clearBlockedUsers();
    expect(isBlockedUser(143)).toBe(false);
  });
});

describe('matchBlockState', () => {
  const none = new Set<number>();

  it('reads the flags GET /dating/matches now sends, both ways', () => {
    expect(matchBlockState({ otherUserId: 9, isBlockedByMe: true, hasBlockedMe: false }, none))
      .toEqual({ blockedByMe: true, blockedMe: false });
    expect(matchBlockState({ otherUserId: 9, isBlockedByMe: false, hasBlockedMe: true }, none))
      .toEqual({ blockedByMe: false, blockedMe: true });
  });

  it("still counts the user's own blocks list, e.g. before the matches reload", () => {
    expect(matchBlockState({ otherUserId: 9 }, new Set([9])))
      .toEqual({ blockedByMe: true, blockedMe: false });
  });

  it('treats missing flags as not blocked', () => {
    expect(matchBlockState({ otherUserId: 9 }, none)).toEqual({ blockedByMe: false, blockedMe: false });
  });
});
