const { state, SERVER_LAYER, CLIENT_LAYER, ACTION_LAYER, NONE_LAYER } = require("./index");

const INTERNAL_COMMENT_REGEX = /\/\*@react-flight\/internal:(.*)\|(.*)\*\//;

module.exports = function flightLoader(source) {
	// TODO: use AST to find directive
	// TODO: use AST to create reference for non-default export

	const matched = source.match(INTERNAL_COMMENT_REGEX);
	const directive = matched[1];
	const exportNames = matched[2].split(",");

	if (state.currentLayer === SERVER_LAYER && directive === "client") {
		state.clientModuleReferences.set(this.resource, {});
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

	if (this.resourceQuery === "?__flight") return source;
	if (directive === "server") {
		if (state.currentLayer === NONE_LAYER) {
			const { callServer } = this.getOptions();
			return `
import { createServerReference } from 'react-server-dom-webpack/client';
import { ${callServer.exportName} } from "${callServer.path}";

const action = createServerReference(String.raw\`${this.resourcePath}\`, ${callServer.exportName});
export default action;
`;
		} else if (state.currentLayer === CLIENT_LAYER) {
			state.serverActionFromClientResources.push(this.resource);
			return `
import { createServerReference } from 'react-server-dom-webpack/client';

const action = createServerReference(String.raw\`${this.resourcePath}\`);
export default action;
`;
		} else if (state.currentLayer === SERVER_LAYER || state.currentLayer === ACTION_LAYER) {
			if (state.currentLayer === SERVER_LAYER) {
				state.serverActionFromServerResources.push(this.resource);
			}
			return `
import { createServerAction } from "${require.resolve("./runtime/server.js")}";
import * as actions from "${this.resourcePath}?__flight";\n

export default createServerAction(String.raw\`${this.resourcePath}\`, actions.default);
`;
		} else {
			throw new Error(`unreachable: use server directive and layer ${state.currentLayer}`);
		}
	}

	return source;
};
