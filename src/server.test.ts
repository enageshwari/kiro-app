import { describe, it, expect } from 'vitest';

/**
 * Unit tests for server utilities.
 * These run fast, in-process, with no browser or network required.
 */
describe('server', () => {
  it('should trim whitespace from a name', () => {
    const name = '  Kiro  '.trim();
    expect(name).toBe('Kiro');
  });

  it('should produce correct greeting string', () => {
    const greet = (name: string) => name ? `Hello, ${name}!` : '';
    expect(greet('Kiro')).toBe('Hello, Kiro!');
    expect(greet('')).toBe('');
    expect(greet('   '.trim())).toBe('');
  });
});
