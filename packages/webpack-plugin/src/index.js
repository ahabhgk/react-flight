const NONE_LAYER = "NONE_LAYER";
const SERVER_LAYER = "SERVER_LAYER";
const CLIENT_LAYER = "CLIENT_LAYER";
const ACTION_LAYER = "ACTION_LAYER";

const state = {
	clientModuleReferences: new Map(),
	serverActionFromServerResources: [],
	serverActionFromClientResources: [],
	currentLayer: SERVER_LAYER,
};

class ReactFlightServerWebpackPlugin {
	constructor(options) {
		this.entryNames = options?.entryNames ?? ["server-entry"];
		this.serverLayer = options?.serverLayer ?? "server";
		this.clientLayer = options?.clientLayer ?? "client";
		this.fromClientActionLayer = options?.actionLayer ?? "action";
		this.serverActionsManifestFilename =
			options?.serverActionsManifestFilename ?? "server-actions.json";
	}

	apply(compiler) {
		compiler.hooks.finishMake.tapPromise(
			ReactFlightServerWebpackPlugin.name,
			async (compilation) => {
				const addClientModules = (clientModuleResources) => {
					return Promise.all(
						this.entryNames.flatMap((name) =>
							clientModuleResources.map((resource) =>
								addModuleTree(name, this.clientLayer, resource)
							)
						)
					);
				};

				const addFromClientServerActions = (serverActionResources) => {
					return Promise.all(
						this.entryNames.flatMap((name) =>
							serverActionResources.map((resource) =>
								addModuleTree(name, this.fromClientActionLayer, resource)
							)
						)
					);
				};

				const addModuleTree = (name, layer, request) => {
					return new Promise((resolve, reject) => {
						const options = { name, layer };
						const dependency = compiler.webpack.EntryPlugin.createDependency(request, {
							name: request,
						});
						const entry = compilation.entries.get(name);
						entry.includeDependencies.push(dependency);
						compilation.hooks.addEntry.call(dependency, options);
						compilation.addModuleTree(
							{
								context: compiler.context,
								dependency,
								contextInfo: { issuerLayer: options.layer },
							},
							(err, module) => {
								if (err) {
									compilation.hooks.failedEntry.call(dependency, options, err);
									return reject(err);
								}
								compilation.hooks.succeedEntry.call(dependency, options, module);
								return resolve(module);
							}
						);
					});
				};

				state.currentLayer = CLIENT_LAYER;
				await addClientModules([...state.clientModuleReferences.keys()]);
				state.currentLayer = ACTION_LAYER;
				await addFromClientServerActions(state.serverActionFromClientResources);
			}
		);

		compiler.hooks.make.tap(ReactFlightServerWebpackPlugin.name, (compilation) => {
			const { webpack } = compiler;
			compilation.hooks.processAssets.tap(
				{
					name: ReactFlightServerWebpackPlugin.name,
					stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
				},
				() => {
					const serverActionResources = new Set(
						[...state.serverActionFromServerResources, ...state.serverActionFromClientResources] ??
							[]
					);
					const serverManifest = {};
					compilation.chunkGroups.forEach((chunkGroup) => {
						const chunkIds = chunkGroup.chunks.map((c) => {
							return c.id;
						});

						const recordModule = (id, module) => {
							if (serverActionResources.has(module.resource)) {
								const resourcePath = module.resource;
								if (resourcePath !== undefined) {
									serverManifest[resourcePath] = {
										id,
										name: "*",
										chunks: chunkIds,
									};
									serverManifest[resourcePath + "#"] = {
										id,
										name: "",
										chunks: chunkIds,
									};

									const moduleProvidedExports = compilation.moduleGraph
										.getExportsInfo(module)
										.getProvidedExports();

									if (Array.isArray(moduleProvidedExports)) {
										moduleProvidedExports.forEach((name) => {
											serverManifest[resourcePath + "#" + name] = {
												id,
												name: name,
												chunks: chunkIds,
											};
										});
									}
								}
							} else if (state.clientModuleReferences.has(module.resource)) {
								const reference = state.clientModuleReferences.get(module.resource);
								reference.ssrId = id;
							}
						};

						chunkGroup.chunks.forEach((chunk) => {
							const chunkModules = compilation.chunkGraph.getChunkModulesIterable(chunk);
							Array.from(chunkModules).forEach((module) => {
								const moduleId = compilation.chunkGraph.getModuleId(module);
								recordModule(moduleId, module);

								if (module.modules) {
									module.modules.forEach((concatenatedMod) => {
										recordModule(moduleId, concatenatedMod);
									});
								}
							});
						});
					});

					const serverOutput = JSON.stringify(serverManifest, null, 2);
					compilation.emitAsset(
						this.serverActionsManifestFilename,
						new webpack.sources.RawSource(serverOutput, false)
					);
				}
			);
		});
	}
}

class ReactFlightClientWebpackPlugin {
	constructor(options) {
		this.clientModuleReferences = options?.clientModuleReferences ?? state.clientModuleReferences;

		if (typeof options?.chunkName === "string") {
			this.chunkName = options.chunkName;

			if (!/\[(index|request)\]/.test(this.chunkName)) {
				this.chunkName += "[index]";
			}
		} else {
			this.chunkName = "client[index]";
		}

		this.clientModulesManifestFilename =
			options?.clientModulesManifestFilename ?? "client-modules.json";
		this.clientModulesSSRManifestFilename =
			options?.clientModulesSSRManifestFilename ?? "client-modules-ssr.json";
	}

	apply(compiler) {
		const { webpack } = compiler;

		class ClientReferenceDependency extends webpack.dependencies.ModuleDependency {
			constructor(request) {
				super(request);
			}

			get type() {
				return "client-reference";
			}
		}

		const clientImportName = "react-server-dom-webpack/client.browser";
		const clientFileName = require.resolve(clientImportName);

		let clientFileNameFound = false;

		compiler.hooks.thisCompilation.tap(
			ReactFlightClientWebpackPlugin.name,
			(compilation, { normalModuleFactory }) => {
				state.currentLayer = NONE_LAYER;
				compilation.dependencyFactories.set(ClientReferenceDependency, normalModuleFactory);
				compilation.dependencyTemplates.set(
					ClientReferenceDependency,
					new webpack.dependencies.NullDependency.Template()
				);

				const handler = (parser) => {
					parser.hooks.program.tap(ReactFlightClientWebpackPlugin.name, () => {
						const module = parser.state.module;

						if (module.resource !== clientFileName) {
							return;
						}

						clientFileNameFound = true;

						if (this.clientModuleReferences) {
							const resources = [...this.clientModuleReferences.keys()];
							for (let i = 0; i < resources.length; i++) {
								const resource = resources[i];
								const dep = new ClientReferenceDependency(resource);

								const chunkName = this.chunkName
									.replace(/\[index\]/g, "" + i)
									.replace(/\[request\]/g, webpack.Template.toPath(dep.userRequest));

								const block = new webpack.AsyncDependenciesBlock(
									{
										name: chunkName,
									},
									null,
									dep.request
								);
								block.addDependency(dep);
								module.addBlock(block);
							}
						}
					});
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("HarmonyModulesPlugin", handler);
				normalModuleFactory.hooks.parser.for("javascript/esm").tap("HarmonyModulesPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("HarmonyModulesPlugin", handler);
			}
		);
		compiler.hooks.make.tap(ReactFlightClientWebpackPlugin.name, (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: ReactFlightClientWebpackPlugin.name,
					stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
				},
				() => {
					if (clientFileNameFound === false) {
						compilation.warnings.push(
							new webpack.WebpackError(
								"Client runtime at " +
									clientImportName +
									" was not found. React Server Components module map file " +
									this.clientManifestFilename +
									" was not created."
							)
						);
						return;
					}

					const clientManifest = {};
					const clientSSRManifest = {};
					compilation.chunkGroups.forEach((chunkGroup) => {
						const chunkIds = chunkGroup.chunks.map((c) => {
							return c.id;
						});

						const recordModule = (id, module) => {
							if (!this.clientModuleReferences.has(module.resource)) {
								return;
							}

							const resourcePath = module.resource;

							if (resourcePath !== undefined) {
								const reference = this.clientModuleReferences.get(module.resource);
								const ssrExports = {};

								clientManifest[resourcePath] = {
									id,
									name: "*",
									chunks: chunkIds,
								};
								ssrExports["*"] = {
									id: reference.ssrId,
									name: "*",
									chunks: [],
								};

								clientManifest[resourcePath + "#"] = {
									id,
									name: "",
									chunks: chunkIds,
								};
								ssrExports[""] = {
									id: reference.ssrId,
									name: "",
									chunks: [],
								};

								const moduleProvidedExports = compilation.moduleGraph
									.getExportsInfo(module)
									.getProvidedExports();

								if (Array.isArray(moduleProvidedExports)) {
									moduleProvidedExports.forEach((name) => {
										clientManifest[resourcePath + "#" + name] = {
											id,
											name: name,
											chunks: chunkIds,
										};
										ssrExports[name] = {
											id: reference.ssrId,
											name,
											chunks: [],
										};
									});
								}

								clientSSRManifest[id] = ssrExports;
							}
						};

						chunkGroup.chunks.forEach((chunk) => {
							const chunkModules = compilation.chunkGraph.getChunkModulesIterable(chunk);
							Array.from(chunkModules).forEach((module) => {
								const moduleId = compilation.chunkGraph.getModuleId(module);
								recordModule(moduleId, module);

								if (module.modules) {
									module.modules.forEach((concatenatedMod) => {
										recordModule(moduleId, concatenatedMod);
									});
								}
							});
						});
					});
					const clientOutput = JSON.stringify(clientManifest, null, 2);
					compilation.emitAsset(
						this.clientModulesManifestFilename,
						new webpack.sources.RawSource(clientOutput, false)
					);
					const clientSSROutput = JSON.stringify(clientSSRManifest, null, 2);
					compilation.emitAsset(
						this.clientModulesSSRManifestFilename,
						new webpack.sources.RawSource(clientSSROutput, false)
					);
				}
			);
		});
	}
}

function reactServerRules(options) {
	const serverLayer = options.serverLayer ?? "server";
	const actionLayer = options.actionLayer ?? "action";
	const conditions = { ...options };
	delete conditions.serverLayer;
	delete conditions.actionLayer;

	return [
		{
			...conditions,
			issuerLayer: { or: [serverLayer, actionLayer] },
			resolve: {
				conditionNames: ["react-server", "..."],
			},
		},
		{
			issuerLayer: [actionLayer],
			layer: serverLayer,
		},
	];
}

/* public api */
module.exports.ReactFlightServerWebpackPlugin = ReactFlightServerWebpackPlugin;
module.exports.ReactFlightClientWebpackPlugin = ReactFlightClientWebpackPlugin;
module.exports.loader = require.resolve("./flight-loader");
module.exports.reactServerRules = reactServerRules;

/* private api */
module.exports.state = state;
module.exports.SERVER_LAYER = SERVER_LAYER;
module.exports.CLIENT_LAYER = CLIENT_LAYER;
module.exports.ACTION_LAYER = ACTION_LAYER;
module.exports.NONE_LAYER = NONE_LAYER;
