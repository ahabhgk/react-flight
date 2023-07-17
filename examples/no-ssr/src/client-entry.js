import ReactDOM from "react-dom/client";
import ErrorBoundary from "./ErrorBoundary";
import { Router } from "./router";

function Root() {
	return (
		<ErrorBoundary>
			<Router />
		</ErrorBoundary>
	);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Root />);
