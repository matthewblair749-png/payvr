// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// lumen/ is a separate Next.js app in this repo; keep Metro from crawling it.
config.resolver.blockList = [/\/lumen\/.*/];

module.exports = config;
