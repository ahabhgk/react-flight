"use client";

import { useState } from "react";
import Container from "./Container.js";
import * as actions from "./actions.js";
// Using global CSS in client components
import "./Counter.css";

export function Counter() {
	const [count, setCount] = useState(0);
	const onClick = () => {
		setCount((c) => c + 1);
		actions.count();
	};
	return (
		<Container>
			<button className="counter-button" onClick={onClick}>
				Count: {count}
			</button>
		</Container>
	);
}
