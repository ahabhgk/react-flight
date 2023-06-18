const path = require("node:path");
const {
	ReactFlightServerWebpackPlugin,
	ReactFlightClientWebpackPlugin,
	loader: flightLoader,
	reactServerRules,
} = require("@react-flight/webpack-plugin");
const { default: reactFlightBabelPlugin } = require("@react-flight/babel-plugin");

const jsRule = {
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
				presets: ["@babel/preset-react"],
				plugins: [reactFlightBabelPlugin],
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
		output: {
			path: path.join(__dirname, "dist", "server"),
		},
		mode: "production",
		target: "node",
		devtool: false,
		module: {
			rules: [
				jsRule,
				{
					test: /\.jsx?$/,
					issuerLayer: "server",
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
			["client-entry"]: "./src/client-entry.js",
		},
		output: {
			filename: "[name]-[contenthash].js",
			path: path.join(__dirname, "dist", "client"),
		},
		mode: "production",
		target: "web",
		devtool: false,
		module: {
			rules: [jsRule],
		},
		plugins: [new ReactFlightClientWebpackPlugin()],
	},
];
