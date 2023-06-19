/** flight types */
exports.SERVER_COMPONENT = Symbol("flight type: server components");
exports.SERVER_ACTION_FROM_SERVER = Symbol("flight type: server actions from server");
exports.SERVER_ACTION_FROM_CLIENT = Symbol("flight type: server actions from client");

/** compile phase */
exports.CSR_PHASE = Symbol("compile phase: client compile - csr client components");
exports.SERVER_PHASE = Symbol(
	"compile phase: server compile - server components, server actions from server"
);
exports.SSR_PHASE = Symbol("compile phase: server compile - ssr client components");
exports.SERVER_FROM_CLIENT_PHASE = Symbol(
	"compile phase: server compile - server actions from client"
);

/** shared state for server plugin and client plugin */
exports.state = {
	clientModuleReferences: new Map(),
	serverActionFromServerResources: new Set(),
	serverActionFromClientResources: new Set(),
	currentPhase: exports.SERVER_PHASE,
};
