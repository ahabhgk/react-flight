import { use, useState, startTransition } from "react";
import ReactDOM from "react-dom/client";
import { createFromFetch, encodeReply } from "react-server-dom-webpack/client";

// TODO: This should be a dependency of the App but we haven't implemented CSS in Node yet.
// import './style.css';

let updateRoot;

export async function callServer(id, args) {
	const response = fetch("/", {
		method: "POST",
		headers: {
			Accept: "text/x-component",
			"rsc-action": id,
		},
		body: await encodeReply(args),
	});
	const { returnValue, root } = await createFromFetch(response, { callServer });
	startTransition(() => {
		updateRoot(root);
	});
	return returnValue;
}

export async function refresh() {
	const root = createFromFetch(
		fetch("/", {
			headers: {
				Accept: "text/x-component",
			},
		}),
		{
			callServer,
		}
	);
	startTransition(() => {
		updateRoot(root);
	});
}

const data = createFromFetch(
	fetch("/", {
		headers: {
			Accept: "text/x-component",
		},
	}),
	{
		callServer,
	}
);

function Shell({ data }) {
	const [root, setRoot] = useState(use(data));
	updateRoot = setRoot;
	return root;
}

ReactDOM.hydrateRoot(document, <Shell data={data} />);
