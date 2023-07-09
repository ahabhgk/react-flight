"use client";

import * as React from "react";
import { experimental_useFormStatus as useFormStatus } from "react-dom";
import ErrorBoundary from "./ErrorBoundary.js";
// Using CSS Modules in client components
import classes from "./Button.module.css";

function ButtonDisabledWhilePending({ action, children }) {
	const { pending } = useFormStatus();
	return (
		<button className={classes.button} disabled={pending} formAction={action}>
			{children}
		</button>
	);
}

export default function Button({ action, children }) {
	return (
		<ErrorBoundary>
			<form>
				<ButtonDisabledWhilePending action={action}>{children}</ButtonDisabledWhilePending>
			</form>
		</ErrorBoundary>
	);
}
