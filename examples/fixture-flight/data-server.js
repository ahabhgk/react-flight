const { Readable } = require("node:stream");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const bodyParser = require("body-parser");
const busboy = require("busboy");
const compress = require("compression");
const {
	default: App,
	setServerState,
	ReactServerDOMWebpackServer,
	React,
	getServerAction,
} = require("./dist/server-entry");

const clientModulesManifest = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, `./dist/client-modules.json`), "utf8")
);
const serverActionsManifest = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, `./dist/server-actions.json`), "utf8")
);

const app = express();

app.use(compress());

function renderApp(returnValue) {
	const root = React.createElement(App);
	// For client-invoked server actions we refresh the tree and return a return value.
	const payload = returnValue ? { returnValue, root } : root;
	return ReactServerDOMWebpackServer.renderToPipeableStream(payload, clientModulesManifest);
}

app.get("/", function (req, res) {
	const { pipe } = renderApp(null);
	pipe(res);
});

app.post("/", bodyParser.text(), async function (req, res) {
	const serverReference = req.get("rsc-action");
	if (serverReference) {
		// This is the client-side case
		const action = getServerAction(serverReference, serverActionsManifest);
		// Validate that this is actually a function we intended to expose and
		// not the client trying to invoke arbitrary functions. In a real app,
		// you'd have a manifest verifying this before even importing it.
		if (action.$$typeof !== Symbol.for("react.server.reference")) {
			throw new Error("Invalid action");
		}

		let args;
		if (req.is("multipart/form-data")) {
			// Use busboy to streamingly parse the reply from form-data.
			const bb = busboy({ headers: req.headers });
			const reply = ReactServerDOMWebpackServer.decodeReplyFromBusboy(bb);
			req.pipe(bb);
			args = await reply;
		} else {
			args = await ReactServerDOMWebpackServer.decodeReply(req.body);
		}
		const result = action.apply(null, args);
		try {
			// Wait for any mutations
			await result;
		} catch (x) {
			// We handle the error on the client
		}
		// Refresh the client and return the value
		const { pipe } = renderApp(result);
		pipe(res);
	} else {
		// This is the progressive enhancement case
		const UndiciRequest = require("undici").Request;
		const fakeRequest = new UndiciRequest("http://localhost", {
			method: "POST",
			headers: { "Content-Type": req.headers["content-type"] },
			body: Readable.toWeb(req),
			duplex: "half",
		});
		const formData = await fakeRequest.formData();
		const action = await ReactServerDOMWebpackServer.decodeAction(formData, serverActionsManifest);
		try {
			// Wait for any mutations
			await action();
		} catch (x) {
			setServerState("Error: " + x.message);
		}
		const { pipe } = renderApp(null);
		pipe(res);
	}
});

app.get("/todos", function (req, res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.json([
		{
			id: 1,
			text: "Shave yaks",
		},
		{
			id: 2,
			text: "Eat kale",
		},
	]);
});

app.listen(3003, () => {
	console.log("Regional Flight Server listening on port 3003...");
});

app.on("error", function (error) {
	if (error.syscall !== "listen") {
		throw error;
	}

	switch (error.code) {
		case "EACCES":
			console.error("port 3003 requires elevated privileges");
			return process.exit(1);
		case "EADDRINUSE":
			console.error("Port 3003 is already in use");
			return process.exit(1);
		default:
			throw error;
	}
});
