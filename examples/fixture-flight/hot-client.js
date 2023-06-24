const hotClient = require("webpack-hot-middleware/client");
const { refresh } = require("./src/client-entry");

hotClient.subscribe((payload) => {
	if (payload.action === "sc-refresh") {
		console.log(`[HMR] server components refresh`);
		refresh();
	}
});

module.exports = hotClient;
