"use server";

import * as todos from "./todos";

export async function finishTodo(formData) {
	const finishedTodoId = parseInt(formData.get("finishedTodoId"), 10);
	await todos.removeTodo(finishedTodoId);
}

export async function addTodo(text) {
	await todos.addTodo(text);
}
