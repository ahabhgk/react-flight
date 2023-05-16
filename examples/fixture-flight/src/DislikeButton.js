"use client";

import * as React from "react";
import dislike from "./dislike";

export default function Button({ children }) {
	return (
		<button
			onClick={async () => {
				const result = await dislike();
				console.log(result);
			}}
		>
			{children}
		</button>
	);
}
