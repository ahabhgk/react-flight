"use client";

import { useState } from "react";
import { addTodo } from "./actions";

export default function AddTodo() {
	const [text, setText] = useState("");
	const onChange = (e) => setText(e.target.value);
	const onClick = async () => {
		await addTodo(text);
		setText("");
	};
	return (
		<div>
			<input value={text} onChange={onChange} />
			<button onClick={onClick}>Add</button>
		</div>
	);
}
