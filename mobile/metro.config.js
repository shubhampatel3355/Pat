// Metro bundler configuration.
//
// The app shares the web app's business helpers (money and date formatting, financial year, labels and
// colours for every status) by bundling them straight from ../src/lib, imported as "@shared/<file>".
// Packages those files import (e.g. zod) resolve from this app's node_modules, never the web's.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const sharedLib = path.resolve(projectRoot, "../src/lib");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), sharedLib];

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (moduleName.startsWith("@shared/")) {
    return context.resolveRequest(context, path.join(sharedLib, moduleName.slice("@shared/".length)), platform);
  }
  const fromShared = context.originModulePath.startsWith(sharedLib + path.sep);
  if (fromShared && !moduleName.startsWith(".") && !path.isAbsolute(moduleName)) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, "package.json") }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
