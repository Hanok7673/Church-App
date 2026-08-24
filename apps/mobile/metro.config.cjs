const { getDefaultConfig } = require("expo/metro-config");
const fs = require("node:fs");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const canonicalModuleOrigin = path.join(__dirname, "package.json");
const canonicalTamaguiPackages = new Set(["@tamagui/core", "@tamagui/web"]);

config.resolver.unstable_enableSymlinks = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (canonicalTamaguiPackages.has(moduleName)) {
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
  if (moduleName === "react-dom/client") {
    return {
      filePath: fs.realpathSync(path.join(__dirname, "node_modules/react-dom/cjs/react-dom-client.production.js")),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
