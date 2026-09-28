module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // htmlparser2 (under @native-html/render) ships `export * as X from`,
    // which the RN preset doesn't compile — the Release bundle step fails.
    '@babel/plugin-transform-export-namespace-from',
    // Must stay last.
    'react-native-reanimated/plugin',
  ],
};
