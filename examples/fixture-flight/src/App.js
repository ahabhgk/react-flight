import Container from "./Container.js";
import { Counter } from "./Counter.js";
import ShowMore from "./ShowMore.js";
import Button from "./Button.js";
import Form from "./Form.js";
import { like, greet, dislike } from "./actions.js";
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
					<ul>
						{todos.map((todo) => (
							<li key={todo.id}>{todo.text}</li>
						))}
					</ul>
					<ShowMore>
						<p>Lorem ipsum</p>
					</ShowMore>
					<Form action={greet} />
					<div>
						<Button action={like}>Like</Button>
						<Button action={dislike}>DisLike</Button>
					</div>
				</Container>
			</body>
		</html>
	);
}
