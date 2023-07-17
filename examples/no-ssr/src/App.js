import AddTodo from "./AddTodo";
import FinishTodo from "./FinishTodo";
import { getTodos } from "./todos";
import "./global.css";

export default async function App() {
	const todos = await getTodos();
	return (
		<div>
			<ul>
				{todos.map((todo) => (
					<li key={todo.id}>
						<span className="todo-text">{todo.text}</span>
						<FinishTodo todo={todo} />
					</li>
				))}
			</ul>
			<AddTodo />
		</div>
	);
}
