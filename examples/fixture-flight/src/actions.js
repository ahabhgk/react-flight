"use server";

import { setServerState } from "./ServerState.js";

export async function like() {
	setServerState("Liked!");
	return new Promise((resolve, reject) => resolve("Liked"));
}

export async function dislike() {
	setServerState("Disliked!");
	return new Promise((resolve, reject) => resolve("Disliked"));
}

export async function greet(formData) {
	const name = formData.get("name") || "you";
	setServerState("Hi " + name);
	const file = formData.get("file");
	if (file) {
		const text = `Ok, ${name}, here is ${file.name}:
      ${(await file.text()).toUpperCase()}
    `;
		console.log(text);
		return text;
	}
	return "Hi " + name + "!";
}

export async function count() {
	console.log("Counting...");
}
