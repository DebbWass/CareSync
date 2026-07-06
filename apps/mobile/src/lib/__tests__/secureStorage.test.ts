/**
 * LargeSecureStore chunking tests.
 * expo-secure-store rejects values over ~2KB, so auth tokens are split into
 * 1800-char chunks — these tests prove the roundtrip and cleanup behavior.
 */
const mockMemory = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockMemory.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockMemory.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockMemory.delete(key);
    return Promise.resolve();
  }),
}));

import { LargeSecureStore } from '../secureStorage';

describe('LargeSecureStore', () => {
  beforeEach(() => mockMemory.clear());

  it('stores small values as a single entry', async () => {
    await LargeSecureStore.setItem('k', 'small-value');
    expect(mockMemory.get('k')).toBe('small-value');
    expect(mockMemory.has('k_count')).toBe(false);
    await expect(LargeSecureStore.getItem('k')).resolves.toBe('small-value');
  });

  it('chunks values larger than 1800 chars and reassembles them losslessly', async () => {
    const big = 'x'.repeat(1800 * 2 + 137); // 3 chunks, last one partial
    await LargeSecureStore.setItem('token', big);

    expect(mockMemory.get('token_count')).toBe('3');
    expect(mockMemory.has('token_chunk_0')).toBe(true);
    expect(mockMemory.has('token_chunk_2')).toBe(true);

    await expect(LargeSecureStore.getItem('token')).resolves.toBe(big);
  });

  it('returns null (not a corrupt partial) when a chunk is missing', async () => {
    const big = 'y'.repeat(4000);
    await LargeSecureStore.setItem('token', big);
    mockMemory.delete('token_chunk_1'); // simulate partial corruption

    await expect(LargeSecureStore.getItem('token')).resolves.toBeNull();
  });

  it('removeItem deletes the count marker and every chunk', async () => {
    const big = 'z'.repeat(4000);
    await LargeSecureStore.setItem('token', big);
    await LargeSecureStore.removeItem('token');

    expect([...mockMemory.keys()].filter((k) => k.startsWith('token'))).toHaveLength(0);
  });

  it('getItem returns null for unknown keys', async () => {
    await expect(LargeSecureStore.getItem('nope')).resolves.toBeNull();
  });
});
