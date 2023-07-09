const FLIGHT_INTERNAL = Symbol("@react-flight/webpack-plugin internal symbol");

function getFlightInfo(module, key) {
	module.buildInfo[FLIGHT_INTERNAL] ??= new Map();
	return module.buildInfo[FLIGHT_INTERNAL].get(key);
}

function setFlightInfo(module, key, value) {
	const prev = getFlightInfo(module, key);
	module.buildInfo[FLIGHT_INTERNAL].set(key, value);
	return prev;
}

exports.getFlightInfo = getFlightInfo;
exports.setFlightInfo = setFlightInfo;
