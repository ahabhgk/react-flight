const bodyParser = require("body-parser");
const express = require("express");
const compress = require("compression");
const busboy = require("busboy");

async function main() {
	const shared = await require("./shared");

	const app = express();

	app.use(compress());

	app.get("/", async function (req, res, next) {
		if (req.accepts("text/html")) {
			next();
		} else if (req.accepts("text/x-component")) {
			try {
				const { App, ReactServerDOMWebpackServer, React } = shared.serverEntry();
				const payload = React.createElement(App);
				const stream = ReactServerDOMWebpackServer.renderToPipeableStream(
					payload,
					await shared.getClientModulesManifest()
				);
				res.set("Content-type", "text/x-component");
				stream.pipe(res);
			} catch (e) {
				console.error(`Failed to proxy request: ${e.stack}`);
				res.statusCode = 500;
				res.end();
			}
		}
	});

	app.post("/", bodyParser.text(), async function (req, res) {
		const { ReactServerDOMWebpackServer, getServerAction } = shared.serverEntry();

		const serverActionsManifest = await shared.getServerActionsManifest();
		const serverReference = req.get("rsc-action");
		if (serverReference) {
			const action = getServerAction(serverReference, serverActionsManifest);
			if (action.$$typeof !== Symbol.for("react.server.reference")) {
				throw new Error("Invalid action");
			}

			let args;
			if (req.is("multipart/form-data")) {
				const bb = busboy({ headers: req.headers });
				const reply = ReactServerDOMWebpackServer.decodeReplyFromBusboy(bb);
				req.pipe(bb);
				args = await reply;
			} else {
				args = await ReactServerDOMWebpackServer.decodeReply(req.body);
			}
			const actionResult = action.apply(null, args);
			try {
				await actionResult;
			} catch (x) {
				// We handle the error on the client
			}
			const stream = ReactServerDOMWebpackServer.renderToPipeableStream(
				actionResult,
				await shared.getClientModulesManifest()
			);
			stream.pipe(res);
		}
	});

	app.use(shared.middlewares);

	app.listen(3002, () => {
		console.log(`Server listening on port 3002...`);
	});

	app.on("error", (error) => {
		if (error.syscall !== "listen") {
			throw error;
		}

		var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

		switch (error.code) {
			case "EACCES":
				console.error(bind + " requires elevated privileges");
				return process.exit(1);
			case "EADDRINUSE":
				console.error(bind + " is already in use");
				return process.exit(1);
			default:
				throw error;
		}
	});
}

main();
