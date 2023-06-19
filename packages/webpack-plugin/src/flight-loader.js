const {
	state,
	SERVER_PHASE,
	SSR_PHASE,
	SERVER_FROM_CLIENT_PHASE,
	CSR_PHASE,
	SERVER_COMPONENT,
	SERVER_ACTION_FROM_SERVER,
	SERVER_ACTION_FROM_CLIENT,
} = require("./shared.js");

const INTERNAL_COMMENT_REGEX = /\/\*@react-flight\/internal:(.*)\|(.*)\*\//;

module.exports = function flightLoader(source) {
	const matched = source.match(INTERNAL_COMMENT_REGEX);
	const directive = matched[1];
	const exportNames = matched[2].split(",");

	// server components
	if (state.currentPhase === SERVER_PHASE && directive === "client") {
		this._module.buildInfo.flightType = SERVER_COMPONENT;
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
		if (state.currentPhase === SSR_PHASE || state.currentPhase === CSR_PHASE) {
			if (state.currentPhase === SSR_PHASE) {
				this._module.buildInfo.flightType = SERVER_ACTION_FROM_CLIENT;
			}
			const { callServer } = this.getOptions();
			let newSource = `
import { createServerReference } from 'react-server-dom-webpack/client';
`;
			if (state.currentPhase === CSR_PHASE) {
				newSource += `
import { ${callServer.exportName} } from "${callServer.path}";
`;
			}
			for (const exportName of exportNames) {
				if (exportName.startsWith("default:")) {
					const arg = state.currentPhase === CSR_PHASE ? callServer.exportName : "undefined";
					newSource += `
export default createServerReference(String.raw\`${`${this.resourcePath}#default`}\`, ${arg});
`;
				} else {
					const arg = state.currentPhase === CSR_PHASE ? callServer.exportName : "undefined";
					newSource += `
export const ${exportName} = createServerReference(String.raw\`${`${this.resourcePath}#${exportName}`}\`, ${arg});
`;
				}
			}
			return newSource;
		}
		if (state.currentPhase === SERVER_PHASE || state.currentPhase === SERVER_FROM_CLIENT_PHASE) {
			if (state.currentPhase === SERVER_PHASE) {
				this._module.buildInfo.flightType = SERVER_ACTION_FROM_SERVER;
			}
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
		throw new Error(`unreachable: use server directive on layer ${state.currentPhase}`);
	}

	return source;
};
