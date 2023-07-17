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
const HtmlWebpackPlugin = require("html-webpack-plugin");

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
					path: path.resolve(__dirname, "./src/router.js"),
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
		name: "server",
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
		name: "client",
		dependencies: ["server"],
		entry: {
			["client-entry"]: "./src/client-entry.js",
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
			new HtmlWebpackPlugin({ template: "index.html" }),
		].filter(Boolean),
	},
];
