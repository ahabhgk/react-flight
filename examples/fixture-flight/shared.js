const path = require("node:path");
const fs = require("node:fs");
const express = require("express");

const outputPath = path.resolve(__dirname, "dist");
const serverEntryPath = path.join(outputPath, "server/server-entry.js");
const clientModulesSSRManifestPath = path.resolve(outputPath, "client/client-components-ssr.json");
const entryManifestPath = path.resolve(outputPath, "client/entry-manifest.json");
const clientModulesManifestPath = path.resolve(outputPath, `client/client-components.json`);
const serverActionsManifestPath = path.resolve(outputPath, `server/server-actions.json`);

const getManifest = (manifestPath) => fs.promises.readFile(manifestPath, "utf-8").then(JSON.parse);

module.exports = (async function create() {
	if (process.env.NODE_ENV === "development") {
		const webpack = require("webpack");
		const devMiddleware = require("webpack-dev-middleware");
		const hotMiddleware = require("webpack-hot-middleware");
		const config = require("./webpack.config");
		const compiler = webpack(config);
		const csrCompiler = compiler.compilers.find((compiler) => compiler.name === "csr");
		const devMiddlewareInstance = devMiddleware(compiler, {
			writeToDisk: true,
			serverSideRender: true,
		});
		return {
			middlewares: [devMiddlewareInstance, hotMiddleware(csrCompiler)],
			getClientModulesSSRManifest: () => getManifest(clientModulesSSRManifestPath),
			getEntryManifest: () => getManifest(entryManifestPath),
			getClientModulesManifest: () => getManifest(clientModulesManifestPath),
			getServerActionsManifest: () => getManifest(serverActionsManifestPath),
			serverEntry: () => require(serverEntryPath),
		};
	}
	if (process.env.NODE_ENV === "production") {
		const clientModulesSSRManifest = await getManifest(clientModulesSSRManifestPath);
		const entryManifest = await getManifest(entryManifestPath);
		const clientModulesManifest = await getManifest(clientModulesManifestPath);
		const serverActionsManifest = await getManifest(serverActionsManifestPath);
		return {
			middlewares: [express.static(path.join(outputPath, "client"))],
			getClientModulesSSRManifest: () => Promise.resolve(clientModulesSSRManifest),
			getEntryManifest: () => Promise.resolve(entryManifest),
			getClientModulesManifest: () => Promise.resolve(clientModulesManifest),
			getServerActionsManifest: () => Promise.resolve(serverActionsManifest),
			serverEntry: () => require(serverEntryPath),
		};
	}
	throw new Error(`Unknown process.env.NODE_ENV: ${process.env.NODE_ENV}`);
})();
