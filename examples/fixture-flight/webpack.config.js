const path = require("node:path");
const webpack = require("webpack");
const {
	ReactFlightServerWebpackPlugin,
	ReactFlightClientWebpackPlugin,
	flightLoader,
	flightCSSLoader,
} = require("@react-flight/webpack-plugin");
const { default: reactFlightBabelPlugin } = require("@react-flight/babel-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";
const mode = isProduction ? "production" : "development";

const jsRule = (isClient) => ({
	test: /\.jsx?$/i,
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
				presets: [["@babel/preset-react", { development: isDevelopment, runtime: "automatic" }]],
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
			clean: true,
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
				{
					test: path.resolve(__dirname, "src/ssr-export.js"),
					layer: "client",
				},
				{
					test: /\.css$/i,
					oneOf: [
						{
							test: /\.module\.css$/i,
							use: [
								{ loader: flightCSSLoader, options: { modules: true } },
								"style-loader",
								{ loader: "css-loader", options: { modules: true } },
							],
						},
						{
							use: [
								{ loader: flightCSSLoader, options: { modules: false } },
								"style-loader",
								{ loader: "css-loader", options: { modules: false } },
							],
						},
					],
				},
			],
		},
		plugins: [
			new ReactFlightServerWebpackPlugin(),
			isDevelopment &&
				function HotReloadRequireCachePlugin(compiler) {
					compiler.hooks.afterEmit.tap(HotReloadRequireCachePlugin.name, (compilation) => {
						for (const emitted of compilation.emittedAssets) {
							const emittedPath = path.resolve(compiler.outputPath, emitted);
							if (require.cache[emittedPath]) {
								delete require.cache[emittedPath];
							}
						}
					});
				},
		].filter(Boolean),
		experiments: {
			layers: true,
		},
	},
	{
		name: "csr",
		dependencies: ["ssr"],
		entry: {
			["client-entry"]: [isDevelopment && "./hot-client.js", "./src/client-entry.js"].filter(
				Boolean
			),
		},
		output: {
			clean: true,
			filename: "[name]-[contenthash].js",
			path: path.join(__dirname, "dist", "client"),
		},
		mode,
		target: "web",
		devtool: false,
		module: {
			rules: [
				jsRule(true),
				{
					test: /\.css$/i,
					oneOf: [
						{
							test: /\.module\.css$/i,
							use: [
								isProduction ? MiniCssExtractPlugin.loader : "style-loader",
								{ loader: "css-loader", options: { modules: true } },
							],
						},
						{
							use: [
								isProduction ? MiniCssExtractPlugin.loader : "style-loader",
								{ loader: "css-loader", options: { modules: false } },
							],
						},
					],
				},
			],
		},
		plugins: [
			new ReactFlightClientWebpackPlugin(),
			isProduction && new MiniCssExtractPlugin({ filename: "[name]-[contenthash].css" }),
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
