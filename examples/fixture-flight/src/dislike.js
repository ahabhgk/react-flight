"use server";

import { setServerState } from "./ServerState.js";

export default async function dislike() {
	setServerState("Disliked!");
	return new Promise((resolve, reject) => resolve("Disliked"));
}
