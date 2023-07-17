import { use, useEffect, useState, startTransition, createContext } from "react";
import { createFromFetch, encodeReply } from "react-server-dom-webpack/client";

let refresh;

export async function callServer(id, args) {
	const response = fetch("/", {
		method: "POST",
		headers: {
			Accept: "text/x-component",
			"rsc-action": id,
		},
		body: await encodeReply(args),
	});
	const actionResult = await createFromFetch(response, { callServer });
	refresh();
	return actionResult;
}

const RouterContext = createContext();
const initialCache = new Map();

export function Router() {
	const [cache, setCache] = useState(initialCache);
	const [location, setLocation] = useState(["/"]);

	const locationKey = JSON.stringify(location);
	let content = cache.get(locationKey);
	if (!content) {
		content = createFromFetch(
			fetch(location[0], {
				headers: {
					Accept: "text/x-component",
				},
			}),
			{ callServer }
		);
		cache.set(locationKey, content);
	}

	refresh = () => {
		startTransition(() => {
			const nextCache = new Map();
			navigate(location[0]);
			setCache(nextCache);
		});
	};

	function navigate(location) {
		startTransition(() => {
			setLocation([location]);
		});
	}

	useEffect(() => {
		if (process.env.NODE_ENV === "development") {
			import(/* webpackMode: "eager" */ "webpack-hot-middleware/client").then((hotClient) => {
				hotClient.subscribe((payload) => {
					if (payload.action === "sc-refresh") {
						console.log(`[HMR] server components refresh`);
						refresh();
					}
				});
			});
		}
	}, []);

	return <RouterContext.Provider value={{ refresh }}>{use(content)}</RouterContext.Provider>;
}

export function useRouter() {
	return useContext(RouterContext);
}
