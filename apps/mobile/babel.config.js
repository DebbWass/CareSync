module.exports = function (api) {
  api.cache(true);

  // When Jest runs tests (NODE_ENV=test), disable the Reanimated Babel plugin.
  // The plugin requires `react-native-worklets/plugin` which is a native-build
  // peer dependency not present in the Node test environment.
  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          reanimated: !isTest,
        },
      ],
    ],
  };
};
