jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

const mockGet = jest.fn();
jest.mock('../src/api/axios', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

import {
  adjustUnreadCount,
  clearUnreadCounts,
  getUnreadCount,
  refreshUnreadCount,
} from '../src/utils/unreadNotifications';

const count = (n: number) => Promise.resolve({ data: { data: n } });

beforeEach(() => {
  mockGet.mockReset();
  clearUnreadCounts();
});

describe('unread notification counts', () => {
  it('loads the count for the module asked for', async () => {
    mockGet.mockReturnValue(count(4));
    await refreshUnreadCount('Dating');
    expect(mockGet).toHaveBeenCalledWith('/notifications/unread-count', { params: { module: 'Dating' } });
    expect(getUnreadCount('Dating')).toBe(4);
    expect(getUnreadCount('Penpal')).toBe(0);
  });

  it('shares one request between headers that focus at the same time', async () => {
    mockGet.mockReturnValue(count(2));
    await Promise.all([refreshUnreadCount('Dating'), refreshUnreadCount('Dating')]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('keeps the last known count when a refresh fails', async () => {
    mockGet.mockReturnValueOnce(count(3)).mockReturnValueOnce(Promise.reject(new Error('offline')));
    await refreshUnreadCount('Dating');
    await refreshUnreadCount('Dating');
    expect(getUnreadCount('Dating')).toBe(3);
  });

  it('follows notifications marked read without going below zero', async () => {
    mockGet.mockReturnValue(count(1));
    await refreshUnreadCount('Dating');
    adjustUnreadCount('Dating', -1);
    expect(getUnreadCount('Dating')).toBe(0);
    adjustUnreadCount('Dating', -1);
    expect(getUnreadCount('Dating')).toBe(0);
  });

  it('forgets the counts on sign-out', async () => {
    mockGet.mockReturnValue(count(5));
    await refreshUnreadCount('Dating');
    clearUnreadCounts();
    expect(getUnreadCount('Dating')).toBe(0);
  });
});
