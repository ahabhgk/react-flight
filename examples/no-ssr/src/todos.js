import "server-only";

let id = 0;
let todos = [];

export async function getTodos() {
	return todos;
}

export async function addTodo(text) {
	todos.push({ id: id++, text });
}

export async function removeTodo(id) {
	todos = todos.filter((todo) => todo.id !== id);
}
