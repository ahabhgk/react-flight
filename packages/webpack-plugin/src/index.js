const { getFlightInfo } = require("./utils");

/** shared state for server plugin and client plugin */
const state = {
	// "use client" client boundary
	clientComponents: new Map(),
	// styles imported by server components, implicit "use client"
	styles: new Set(),
	serverActions: new Set(),
};

class ServerComponentInvalidatedWebpackPlugin {
	constructor(callback) {
		this.prevSCModuleHashes = null;
		this.callback = callback;
	}

	apply(compiler) {
		compiler.hooks.done.tap(ServerComponentInvalidatedWebpackPlugin.name, ({ compilation }) => {
			const moduleHashes = ServerComponentInvalidatedWebpackPlugin.collectModuleHashes(compilation);
			// initial
			if (this.prevSCModuleHashes === null) return this.final(false, moduleHashes);
			// add or delete, fast path
			if (this.prevSCModuleHashes.size !== moduleHashes.size) return this.final(true, moduleHashes);
			for (const [identifier, hash] of moduleHashes) {
				const prevHash = this.prevSCModuleHashes.get(identifier);
				// add
				if (!prevHash) return this.final(true, moduleHashes);
				// change
				if (prevHash !== hash) return this.final(true, moduleHashes);
				this.prevSCModuleHashes.delete(identifier);
			}
			// delete
			if (this.prevSCModuleHashes.size > 0) return this.final(true, moduleHashes);
			return this.final(false, moduleHashes);
		});
	}

	final(changed, moduleHashes) {
		this.prevSCModuleHashes = moduleHashes;
		this.callback(changed);
	}

	static collectModuleHashes(compilation) {
		const map = new Map();
		for (const module of compilation.modules) {
			const directive = getFlightInfo(module, "directive");
			if (module.layer === "server" && directive === "none" && module.buildInfo.hash) {
				map.set(module.identifier(), module.buildInfo.hash);
			}
		}
		return map;
	}
}

class ReactFlightServerWebpackPlugin {
	constructor(options) {
		this.entryNames = options?.entryNames ?? ["server-entry"];
		this.serverLayer = options?.serverLayer ?? "server";
		this.clientLayer = options?.clientLayer ?? "client";
		this.serverActionsManifestFilename =
			options?.serverActionsManifestFilename ?? "server-actions.json";
	}

	apply(compiler) {
		const { webpack } = compiler;

		compiler.hooks.beforeCompile.tap(ReactFlightServerWebpackPlugin.name, () => {
			state.clientComponents.clear();
			state.styles.clear();
			state.serverActions.clear();
		});

		compiler.hooks.finishMake.tapPromise(
			ReactFlightServerWebpackPlugin.name,
			async (compilation) => {
				const addEntry = (resources, layer) => {
					// use dynamic import to ensure not to be tree-shaken or concatenated
					const source = resources
						.map((resource) => `import(/* webpackMode: "eager" */ ${JSON.stringify(resource)});`)
						.join("");
					const request = `data:text/javascript,${source}`;
					return Promise.all(this.entryNames.map((name) => addModuleTree(name, layer, request)));
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

				const collectResources = (directive, collect) => {
					for (const module of compilation.modules) {
						if (directive === getFlightInfo(module, "directive")) {
							collect(module.resource);
						}
					}
				};

				collectResources("css", (resource) => state.styles.add(resource));
				collectResources("client", (resource) => state.clientComponents.set(resource, {}));
				await addEntry([...state.clientComponents.keys()], this.clientLayer);
				collectResources("server", (resource) => state.serverActions.add(resource));
				await addEntry([...state.serverActions], this.serverLayer);
			}
		);

		compiler.hooks.make.tap(ReactFlightServerWebpackPlugin.name, (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: ReactFlightServerWebpackPlugin.name,
					stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
				},
				() => {
					const serverManifest = {};
					compilation.chunkGroups.forEach((chunkGroup) => {
						const chunkIds = chunkGroup.chunks.map((c) => {
							return c.id;
						});

						const recordModule = (id, module) => {
							if (module?.layer === this.serverLayer && state.serverActions.has(module.resource)) {
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

									const moduleExportsInfo = compilation.moduleGraph.getExportsInfo(module);
									[...moduleExportsInfo.orderedExports].forEach((exportInfo) => {
										serverManifest[resourcePath + "#" + exportInfo.name] = {
											id,
											name: exportInfo.getUsedName(),
											chunks: chunkIds,
										};
									});
								}
							} else if (
								module?.layer === this.clientLayer &&
								state.clientComponents.has(module.resource)
							) {
								const reference = state.clientComponents.get(module.resource);
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
		this.clientComponents = options?.clientComponents ?? state.clientComponents;
		this.styles = options?.styles ?? state.styles;

		if (typeof options?.chunkName === "string") {
			this.chunkName = options.chunkName;

			if (!/\[(index|request)\]/.test(this.chunkName)) {
				this.chunkName += "[index]";
			}
		} else {
			this.chunkName = "client[index]";
		}

		this.clientComponentsManifestFilename =
			options?.clientComponentsManifestFilename ?? "client-components.json";
		this.clientComponentsSSRManifestFilename =
			options?.clientComponentsSSRManifestFilename ?? "client-components-ssr.json";
	}

	apply(compiler) {
		const { webpack } = compiler;

		class ClientReferenceDependency extends webpack.dependencies.ModuleDependency {
			constructor(request, css) {
				super(request);
				this.css = css;
			}

			get type() {
				return "client-reference";
			}
		}

		ClientReferenceDependency.Template = class ClientReferenceDependencyTemplate extends (
			webpack.dependencies.NullDependency.Template
		) {
			apply(
				dep,
				source,
				{ runtimeTemplate, runtimeRequirements, module, moduleGraph, chunkGraph }
			) {
				if (dep.css) {
					const importStatement = runtimeTemplate.importStatement({
						update: false,
						module: moduleGraph.getModule(dep),
						chunkGraph,
						importVar: webpack.Template.toIdentifier(dep.userRequest),
						request: dep.request,
						originModule: module,
						runtimeRequirements,
					});
					source.insert(Infinity, importStatement[0] + importStatement[1]);
				}
			}
		};

		const clientImportName = "react-server-dom-webpack/client.browser";
		const clientFileName = require.resolve(clientImportName);

		let clientFileNameFound = false;

		compiler.hooks.thisCompilation.tap(
			ReactFlightClientWebpackPlugin.name,
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(ClientReferenceDependency, normalModuleFactory);
				compilation.dependencyTemplates.set(
					ClientReferenceDependency,
					new ClientReferenceDependency.Template()
				);

				const handler = (parser) => {
					parser.hooks.program.tap(ReactFlightClientWebpackPlugin.name, () => {
						const module = parser.state.module;

						if (module.resource !== clientFileName) {
							return;
						}

						clientFileNameFound = true;

						if (this.clientComponents) {
							const resources = [...this.clientComponents.keys()];
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
						if (this.styles) {
							for (const resource of this.styles) {
								const dep = new ClientReferenceDependency(resource, true);
								module.addDependency(dep);
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
							if (!this.clientComponents.has(module.resource)) {
								return;
							}

							const resourcePath = module.resource;

							if (resourcePath !== undefined) {
								const reference = this.clientComponents.get(module.resource);
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
						this.clientComponentsManifestFilename,
						new webpack.sources.RawSource(clientOutput, false)
					);
					const clientSSROutput = JSON.stringify(clientSSRManifest, null, 2);
					compilation.emitAsset(
						this.clientComponentsSSRManifestFilename,
						new webpack.sources.RawSource(clientSSROutput, false)
					);
				}
			);
		});
	}
}

exports.ReactFlightServerWebpackPlugin = ReactFlightServerWebpackPlugin;
exports.ReactFlightClientWebpackPlugin = ReactFlightClientWebpackPlugin;
exports.ServerComponentInvalidatedWebpackPlugin = ServerComponentInvalidatedWebpackPlugin;
exports.flightLoader = require.resolve("./flight-loader");
exports.flightCSSLoader = require.resolve("./flight-css-loader");
