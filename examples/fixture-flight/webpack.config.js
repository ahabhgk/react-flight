const path = require("node:path");
const webpack = require("webpack");
const {
	ReactFlightServerWebpackPlugin,
	ReactFlightClientWebpackPlugin,
	loader: flightLoader,
} = require("@react-flight/webpack-plugin");
const { default: reactFlightBabelPlugin } = require("@react-flight/babel-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";
const mode = isProduction ? "production" : "development";

const jsRule = (isClient) => ({
	test: /\.jsx?$/,
	exclude: /node_modules/,
	use: [
		{
			loader: flightLoader,
			options: {
				callServer: {
					exportName: "callServer",
					path: path.resolve(__dirname, "./src/client-entry.js"),
				},
			},
		},
		{
			loader: "babel-loader",
			options: {
				presets: [["@babel/preset-react", { development: isDevelopment }]],
				plugins: [
					isDevelopment && isClient && "react-refresh/babel",
					reactFlightBabelPlugin,
				].filter(Boolean),
			},
		},
	],
});

/** @type {import('webpack').Configuration} */
module.exports = [
	{
		name: "ssr",
		entry: {
			["server-entry"]: {
				import: ["./src/server-entry.js"],
				layer: "server",
				library: {
					type: "commonjs2",
				},
			},
		},
		output: {
			path: path.join(__dirname, "dist", "server"),
		},
		mode,
		target: "node",
		devtool: false,
		module: {
			rules: [
				jsRule(false),
				{
					test: /\.jsx?$/,
					issuerLayer: "server",
					resolve: {
						conditionNames: ["react-server", "..."],
					},
				},
			],
		},
		plugins: [
			new ReactFlightServerWebpackPlugin(),
			function HotReloadRequireCache(compiler) {
				compiler.hooks.afterEmit.tap(HotReloadRequireCache.name, (compilation) => {
					for (const emitted of compilation.emittedAssets) {
						const emittedPath = path.resolve(compiler.outputPath, emitted);
						if (Object.hasOwn(require.cache, emittedPath)) {
							delete require.cache[emittedPath];
						}
					}
				});
			},
		],
		externals: {
			react: "node-commonjs react",
			"react-dom": "node-commonjs react-dom",
			"react-dom/server": "node-commonjs react-dom/server",
		},
		experiments: {
			layers: true,
		},
	},
	{
		name: "csr",
		dependencies: ["ssr"],
		entry: {
			["client-entry"]: [
				isDevelopment && "webpack-hot-middleware/client",
				"./src/client-entry.js",
			].filter(Boolean),
		},
		output: {
			filename: "[name]-[contenthash].js",
			path: path.join(__dirname, "dist", "client"),
		},
		mode,
		target: "web",
		devtool: false,
		module: {
			rules: [jsRule(true)],
		},
		plugins: [
			new ReactFlightClientWebpackPlugin(),
			isDevelopment &&
				new ReactRefreshWebpackPlugin({
					overlay: {
						sockIntegration: "whm",
					},
				}),
			isDevelopment && new webpack.HotModuleReplacementPlugin(),
			function EntryManifestPlugin(compiler) {
				compiler.hooks.thisCompilation.tap(EntryManifestPlugin.name, (compilation) => {
					compilation.hooks.processAssets.tap(EntryManifestPlugin.name, () => {
						const manifest = {};
						for (const [name, entrypoint] of compilation.entrypoints) {
							const files = entrypoint.getFiles().filter((file) => {
								const asset = compilation.getAsset(file);
								if (!asset) {
									return true;
								}
								const info = asset.info ?? {};
								return !(info.hotModuleReplacement || info.development);
							});
							manifest[name] = {
								js: files.filter((filename) => filename.endsWith(".js")),
								css: files.filter((filename) => filename.endsWith(".css")),
							};
						}
						compilation.emitAsset(
							"entry-manifest.json",
							new compiler.webpack.sources.RawSource(JSON.stringify(manifest, null, 2))
						);
					});
				});
			},
		].filter(Boolean),
	},
];
