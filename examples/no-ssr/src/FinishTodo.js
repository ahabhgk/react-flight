import { finishTodo } from "./actions";

export default function FinishTodo({ todo }) {
	return (
		<form className="todo-done-form">
			<input type="hidden" name="finishedTodoId" value={todo.id} />
			<button type="submit" formAction={finishTodo}>
				Done
			</button>
		</form>
	);
}
