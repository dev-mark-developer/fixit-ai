import { formatPhoneInput, isValidEmail, phoneDigits } from '../src/utils/validation';

describe('formatPhoneInput', () => {
  it('builds the mask as the user types', () => {
    expect(formatPhoneInput('5')).toBe('5');
    expect(formatPhoneInput('555')).toBe('555');
    expect(formatPhoneInput('5551')).toBe('(555) 1');
    expect(formatPhoneInput('555123')).toBe('(555) 123');
    expect(formatPhoneInput('5551234567')).toBe('(555) 123-4567');
  });

  it('is stable when re-applied to its own output', () => {
    expect(formatPhoneInput(formatPhoneInput('5551234567'))).toBe('(555) 123-4567');
  });

  it('ignores anything past ten digits', () => {
    expect(formatPhoneInput('55512345678999')).toBe('(555) 123-4567');
  });

  it('leaves an international number unformatted rather than forcing a US shape', () => {
    expect(formatPhoneInput('+447700900123')).toBe('+447700900123');
    expect(formatPhoneInput('+')).toBe('+');
    expect(formatPhoneInput('+44 7700 900123')).toBe('+447700900123');
  });

  it('lets the user delete back through the mask', () => {
    // Backspacing "(555) 1" removes the digit, not just a mask character.
    expect(formatPhoneInput('(555) ')).toBe('555');
  });
});

describe('phoneDigits', () => {
  it('strips the mask for the API', () => {
    expect(phoneDigits('(555) 123-4567')).toBe('5551234567');
    expect(phoneDigits('+447700900123')).toBe('+447700900123');
    expect(phoneDigits('')).toBe('');
    expect(phoneDigits('   ')).toBe('');
  });
});

describe('isValidEmail', () => {
  it('still rejects what the old unanchored check let through', () => {
    expect(isValidEmail('jo bloggs@x.com')).toBe(false);
    expect(isValidEmail('a@b.co')).toBe(true);
  });
});
