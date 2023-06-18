const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const express = require("express");
const compress = require("compression");
const { ReactServerDOMWebpackClient, ReactDOMServer } = require("./dist/server/server-entry");

const clientModulesSSRManifest = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, `./dist/client/client-modules-ssr.json`), "utf8")
);

const app = express();

app.use(compress());

app.use(express.static(path.join(__dirname, "dist", "client")));

function request(options, body) {
	return new Promise((resolve, reject) => {
		const req = http.request(options, (res) => {
			resolve(res);
		});
		req.on("error", (e) => {
			reject(e);
		});
		body.pipe(req);
	});
}

app.all("/", async function (req, res) {
	// Proxy the request to the regional server.
	const proxiedHeaders = {
		"X-Forwarded-Host": req.hostname,
		"X-Forwarded-For": req.ips,
		"X-Forwarded-Port": 3000,
		"X-Forwarded-Proto": req.protocol,
	};
	// Proxy other headers as desired.
	if (req.get("rsc-action")) {
		proxiedHeaders["Content-type"] = req.get("Content-type");
		proxiedHeaders["rsc-action"] = req.get("rsc-action");
	} else if (req.get("Content-type")) {
		proxiedHeaders["Content-type"] = req.get("Content-type");
	}

	const promiseForData = request(
		{
			host: "127.0.0.1",
			port: 3003,
			method: req.method,
			path: "/",
			headers: proxiedHeaders,
		},
		req
	);

	if (req.accepts("text/html")) {
		try {
			const rscResponse = await promiseForData;
			// For HTML, we're a "client" emulator that runs the client code,
			// so we start by consuming the RSC payload. This needs a module
			// map that reverse engineers the client-side path to the SSR path.
			const root = await ReactServerDOMWebpackClient.createFromNodeStream(
				rscResponse,
				clientModulesSSRManifest
			);
			// Render it into HTML by resolving the client components
			res.set("Content-type", "text/html");
			const { pipe } = ReactDOMServer.renderToPipeableStream(root, {
				bootstrapScripts: ["client-entry-8a6ea1e0bd297105e030.js"],
			});
			pipe(res);
		} catch (e) {
			console.error(`Failed to SSR: ${e.stack}`);
			res.statusCode = 500;
			res.end();
		}
	} else {
		try {
			const rscResponse = await promiseForData;
			// For other request, we pass-through the RSC payload.
			res.set("Content-type", "text/x-component");
			rscResponse.on("data", (data) => {
				res.write(data);
				res.flush();
			});
			rscResponse.on("end", (data) => {
				res.end();
			});
		} catch (e) {
			console.error(`Failed to proxy request: ${e.stack}`);
			res.statusCode = 500;
			res.end();
		}
	}
});

app.listen(3002, () => {
	console.log(`Global Fizz/Webpack Server listening on port 3002...`);
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
