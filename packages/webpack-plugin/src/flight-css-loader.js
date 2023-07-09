const { setFlightInfo } = require("./utils");

module.exports = function flightCSSLoader(source) {
	const options = this.getOptions();
	setFlightInfo(this._module, "directive", "css");
	const hash = this.utils.createHash();
	hash.update(source);
	const digest = hash.digest(this._compilation.outputOptions.hashDigest);
	if (options.modules) {
		return `${source}\nexport const digest = ${JSON.stringify(digest)}`;
	}
	return `export default ${JSON.stringify(digest)}`;
};
