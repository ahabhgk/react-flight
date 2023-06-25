"use client";

import { useState } from "react";
import Container from "./Container.js";
import * as actions from "./actions.js";

export function Counter() {
	const [count, setCount] = useState(0);
	const onClick = () => {
		setCount((c) => c + 1);
		actions.count();
	};
	return (
		<Container>
			<button onClick={onClick}>Count: {count}</button>
		</Container>
	);
}
