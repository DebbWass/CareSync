/* global jest */
// Global Jest mocks for native modules that don't exist in the Node test env.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
