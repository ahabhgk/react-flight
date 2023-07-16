import AddTodo from "./AddTodo";
import { finishTodo } from "./actions";
import { getTodos } from "./todos";

function FinishTodoButton({ todo }) {
	return (
		<form>
			<input type="hidden" name="finishedTodoId" value={todo.id} />
			<button type="submit" formAction={finishTodo}>
				Done
			</button>
		</form>
	);
}

export default async function App() {
	const todos = await getTodos();
	return (
		<div>
			<ul>
				{todos.map((todo) => (
					<li key={todo.id}>
						<span>{todo.text}</span>
						<FinishTodoButton todo={todo} />
					</li>
				))}
			</ul>
			<AddTodo />
		</div>
	);
}
