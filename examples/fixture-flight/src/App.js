import Container from "./Container.js";
import { Counter } from "./Counter.js";
import ShowMore from "./ShowMore.js";
import Button from "./Button.js";
import Form from "./Form.js";
import { like, greet, dislike } from "./actions.js";
import { getServerState } from "./ServerState.js";
// Using global CSS in server components
import "./global.css";
// Using CSS Modules in server components
import classes from "./App.module.css";

export default async function App({ cssPaths }) {
	const res = await fetch("http://localhost:3003/todos");
	const todos = await res.json();
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>Flight</title>
				{cssPaths.map((cssPath) => (
					<link rel="stylesheet" href={cssPath} key={cssPath}></link>
				))}
			</head>
			<body>
				<Container>
					<h1 className={classes.header}>{getServerState()}</h1>
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
