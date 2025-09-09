import { validateEmail } from './validateEmail';

describe('validateEmail', () => {
  it('rejects invalid email', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user@com')).toBe(false);
  });

  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co')).toBe(true);
  });
});
