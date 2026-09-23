/**
 * The location helper sits in front of sign-in, sign-up and the Discover deck,
 * so it must always answer. These mock @react-native-community/geolocation the
 * way it behaves on iOS: `requestAuthorization` calls back only when the
 * authorization *changes* — the first request gets an answer, a repeat request
 * never does.
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  PermissionsAndroid: {},
}));

type Callback = (...args: any[]) => void;

const mockGeo = {
  // Mimics RNCGeolocation.mm: only the first call is ever answered.
  answeredOnce: false,
  requestAuthorization: jest.fn((success: Callback, _error?: Callback) => {
    if (!mockGeo.answeredOnce) {
      mockGeo.answeredOnce = true;
      success();
    }
  }),
  getCurrentPosition: jest.fn(),
  setRNConfiguration: jest.fn(),
};

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: mockGeo,
}));

const FIX = { coords: { latitude: 24.86, longitude: 67.0 } };

function loadModule() {
  let mod: typeof import('../src/utils/location');
  jest.isolateModules(() => {
    mod = require('../src/utils/location');
  });
  return mod!;
}

beforeEach(() => {
  jest.useRealTimers();
  mockGeo.answeredOnce = false;
  mockGeo.requestAuthorization.mockClear();
  mockGeo.getCurrentPosition.mockReset();
});

describe('getCurrentCoords (iOS)', () => {
  it('still answers once the first permission request is used up', async () => {
    // The bug: a sign-in after the cache lapsed asked iOS for permission a
    // second time, the callback never came, and the button spun forever.
    mockGeo.getCurrentPosition.mockImplementation((ok: Callback) => ok(FIX));
    const { getCurrentCoords } = loadModule();

    await expect(getCurrentCoords({ force: true })).resolves.toEqual(FIX.coords);
    await expect(getCurrentCoords({ force: true })).resolves.toEqual(FIX.coords);
    await expect(getCurrentCoords({ force: true })).resolves.toEqual(FIX.coords);
    // Asked once, answer shared — never re-asked.
    expect(mockGeo.requestAuthorization).toHaveBeenCalledTimes(1);
  });

  it('gives up at the ceiling when no permission answer ever comes', async () => {
    jest.useFakeTimers();
    mockGeo.answeredOnce = true; // e.g. already asked by an earlier run of the module
    const { getCurrentCoords } = loadModule();

    const pending = getCurrentCoords({ timeoutMs: 3000 });
    jest.advanceTimersByTime(3500);
    await expect(pending).resolves.toBeNull();
    expect(mockGeo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('gives up at the ceiling when the position never arrives', async () => {
    jest.useFakeTimers();
    mockGeo.getCurrentPosition.mockImplementation(() => {}); // goes quiet
    const { getCurrentCoords } = loadModule();

    const pending = getCurrentCoords({ timeoutMs: 3000 });
    await Promise.resolve(); // let the permission answer land
    jest.advanceTimersByTime(3500);
    await expect(pending).resolves.toBeNull();
  });

  it('returns null, without asking again, after a refusal', async () => {
    mockGeo.requestAuthorization.mockImplementationOnce((_ok: Callback, no?: Callback) => no?.());
    const { getCurrentCoords } = loadModule();

    await expect(getCurrentCoords()).resolves.toBeNull();
    await expect(getCurrentCoords()).resolves.toBeNull();
    expect(mockGeo.requestAuthorization).toHaveBeenCalledTimes(1);
    expect(mockGeo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('serves a recent fix from the cache without touching the GPS', async () => {
    mockGeo.getCurrentPosition.mockImplementation((ok: Callback) => ok(FIX));
    const { getCurrentCoords } = loadModule();

    await getCurrentCoords();
    await expect(getCurrentCoords()).resolves.toEqual(FIX.coords);
    expect(mockGeo.getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
