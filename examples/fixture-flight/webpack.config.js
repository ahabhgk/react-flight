const path = require("node:path");
const {
	ReactFlightServerWebpackPlugin,
	ReactFlightClientWebpackPlugin,
	loader: flightLoader,
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
		plugins: [
			new ReactFlightClientWebpackPlugin(),
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
		],
	},
];
