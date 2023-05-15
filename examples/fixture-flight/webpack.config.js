const path = require("node:path");
const {
	ReactFlightServerWebpackPlugin,
	ReactFlightClientWebpackPlugin,
	loader: flightLoader,
} = require("@react-flight/webpack-plugin");

const jsRule = {
	test: /\.jsx?$/,
	exclude: /node_modules/,
	use: [
		{
			loader: "babel-loader",
			options: {
				presets: ["@babel/preset-react"],
			},
		},
		{
			loader: flightLoader,
			options: {
				callServer: {
					exportName: "callServer",
					path: path.resolve(__dirname, "./src/client-entry.js"),
				},
			},
		},
	],
};

/** @type {import('webpack').Configuration} */
module.exports = [
	{
		name: "ssr",
		entry: {
			["server-entry"]: {
				import: "./src/server-entry.js",
				layer: "server",
				library: {
					type: "commonjs2",
				},
			},
		},
		mode: "development",
		target: "node",
		devtool: false,
		module: {
			rules: [
				jsRule,
				{
					test: /\.jsx?$/,
					issuerLayer: { or: ["server", "action"] },
					resolve: {
						conditionNames: ["react-server", "..."],
					},
				},
			],
		},
		plugins: [new ReactFlightServerWebpackPlugin()],
		externals: {
			react: "node-commonjs react",
			"react-dom": "node-commonjs react-dom",
		},
		experiments: {
			layers: true,
		},
	},
	{
		name: "csr",
		dependencies: ["ssr"],
		entry: {
			["client-entry"]: "./src/client-entry.js",
		},
		mode: "development",
		target: "web",
		devtool: false,
		module: {
			rules: [jsRule],
		},
		plugins: [new ReactFlightClientWebpackPlugin()],
	},
];
