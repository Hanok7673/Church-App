const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const canonicalModuleOrigin = path.join(__dirname, "package.json");
const canonicalSingletonPackages = [
  "react",
  "react-dom",
  "react-native",
  "react-native-web",
  "tamagui",
  "@tamagui/core",
  "@tamagui/web",
];

function isCanonicalSingleton(moduleName) {
  return canonicalSingletonPackages.some(
    (packageName) => moduleName === packageName || moduleName.startsWith(`${packageName}/`),
  );
}

config.resolver.unstable_enableSymlinks = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isCanonicalSingleton(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: canonicalModuleOrigin },
      moduleName,
      platform,
    );
  }

  const isExpoRouterTypeOnlyRuntime =
    moduleName === "./types" &&
    context.originModulePath.replaceAll("\\", "/").includes("/expo-router/build/");
  const isExpoWebLocationNoop =
    moduleName === "./location/install" &&
    context.originModulePath.replaceAll("\\", "/").includes("/@expo/metro-runtime/src/index.ts");

  if (isExpoRouterTypeOnlyRuntime || isExpoWebLocationNoop) {
    return { filePath: path.join(__dirname, "src/metro/empty.js"), type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
