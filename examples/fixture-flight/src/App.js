import * as React from "react";

import Container from "./Container.js";

import Counter from "./Counter.js";
// import {Counter as Counter2} from './Counter2.js';

import ShowMore from "./ShowMore.js";
import LikeButton from "./LikeButton.js";
import Form from "./Form.js";

import like from "./like.js";

import { getServerState } from "./ServerState.js";

export default async function App() {
	const res = await fetch("http://localhost:3003/todos");
	const todos = await res.json();
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>Flight</title>
			</head>
			<body>
				<Container>
					<h1>{getServerState()}</h1>
					<Counter />
					{/* <Counter2 /> */}
					<ul>
						{todos.map((todo) => (
							<li key={todo.id}>{todo.text}</li>
						))}
					</ul>
					<ShowMore>
						<p>Lorem ipsum</p>
					</ShowMore>
					{/* <Form action={greet} /> */}
					<div>
						<LikeButton action={like}>Like</LikeButton>
					</div>
				</Container>
			</body>
		</html>
	);
}
