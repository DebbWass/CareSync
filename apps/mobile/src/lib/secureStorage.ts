import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;

export const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (!countStr) return SecureStore.getItemAsync(key);
    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk == null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk))
    );
  },

  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    await SecureStore.deleteItemAsync(key);
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    await SecureStore.deleteItemAsync(`${key}_count`);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
      )
    );
  },
};
