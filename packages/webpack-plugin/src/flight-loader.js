const INTERNAL_COMMENT_REGEX = /\/\*@react-flight\/internal:(.*)\|(.*)\*\//;

module.exports = function flightLoader(source) {
	const matched = source.match(INTERNAL_COMMENT_REGEX);
	const directive = matched[1];
	const exportNames = matched[2].split(",");
	const layer = this._module.layer;

	this._module.buildInfo.directive = directive;

	// client components
	if (directive === "client" && layer === "server") {
		let count = 0;
		let newSource = `
	import { createClientReference } from "${require.resolve("./runtime/server.js")}";
	const clientReference = createClientReference(String.raw\`${this.resourcePath}\`);

	const { __esModule, $$typeof } = clientReference;
	const __default__ = clientReference.default;
	`;
		for (const exportName of exportNames) {
			if (exportName === "default") {
				newSource += `
	export { __esModule, $$typeof };
	export default __default__;
	`;
			} else {
				newSource += `
	const e${count} = clientReference["${exportName}"];
	export { e${count++} as ${exportName} };
	`;
			}
		}
		return newSource;
	}

	// server actions
	if (directive === "server") {
		if (layer === "client" || layer === null) {
			const { callServer } = this.getOptions();
			let newSource = `
import { createServerReference } from 'react-server-dom-webpack/client';
`;
			if (layer === null) {
				newSource += `
import { ${callServer.exportName} } from "${callServer.path}";
`;
			}
			for (const exportName of exportNames) {
				if (exportName.startsWith("default:")) {
					const arg = layer === null ? callServer.exportName : "undefined";
					newSource += `
export default createServerReference(String.raw\`${`${this.resourcePath}#default`}\`, ${arg});
`;
				} else {
					const arg = layer === null ? callServer.exportName : "undefined";
					newSource += `
export const ${exportName} = createServerReference(String.raw\`${`${this.resourcePath}#${exportName}`}\`, ${arg});
`;
				}
			}
			return newSource;
		}
		if (layer === "server") {
			let newSource = `
${source}
import { createServerAction } from "${require.resolve("./runtime/server.js")}";
`;
			for (const exportName of exportNames) {
				if (exportName.startsWith("default:")) {
					const defaultExportName = exportName.slice(8);
					newSource += `
createServerAction(String.raw\`${`${this.resourcePath}#default`}\`, ${defaultExportName});
`;
				} else {
					newSource += `
createServerAction(String.raw\`${`${this.resourcePath}#${exportName}`}\`, ${exportName});
`;
				}
			}
			return newSource;
		}
		throw new Error(`unreachable: use server directive on layer '${layer}'`);
	}

	return source;
};
