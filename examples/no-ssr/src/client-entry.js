import ReactDOM from "react-dom/client";
import { createFromFetch } from "react-server-dom-webpack/client";
import ErrorBoundary from "./ErrorBoundary";
import { Router, callServer } from "./router";

const data = createFromFetch(
	fetch("/", {
		headers: {
			Accept: "text/x-component",
		},
	}),
	{ callServer }
);

function Root() {
	return (
		<ErrorBoundary>
			<Router data={data} />
		</ErrorBoundary>
	);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Root />);
