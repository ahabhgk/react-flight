const { state, SERVER_LAYER, ACTION_LAYER, NONE_LAYER } = require("./index");

function hasDirective(source, directive) {
	const trimed = source.trimStart();
	return (
		trimed.startsWith(`"${directive}"\n`) ||
		trimed.startsWith(`"${directive}";\n`) ||
		trimed.startsWith(`'${directive}'\n`) ||
		trimed.startsWith(`'${directive}';\n`)
	);
}

module.exports = function flightLoader(source) {
	// TODO: use AST to find directive
	// TODO: use AST to create reference for non-default export

	if (state.currentLayer === SERVER_LAYER && hasDirective(source, "use client")) {
		state.clientModuleReferences.set(this.resource, {});
		return `
import { createClientModule } from "${require.resolve("./runtime/server.js")}";

const clientReference = createClientModule(String.raw\`${this.resourcePath}\`);

export default clientReference;
`;
	}

	if (this.resourceQuery === "?__flight") return source;
	if (hasDirective(source, "use server")) {
		if (state.currentLayer === ACTION_LAYER || state.currentLayer === NONE_LAYER) {
			const { callServer } = this.getOptions();
			state.serverActionFromClientResources.push(this.resource);
			return `
import { createServerReference } from 'react-server-dom-webpack/client.browser';
import { ${callServer.exportName} } from "${callServer.path}";

const action = createServerReference(String.raw\`${this.resourcePath}\`, ${callServer.exportName});
export default action;
`;
		} else if (state.currentLayer === SERVER_LAYER) {
			state.serverActionFromServerResources.push(this.resource);
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
