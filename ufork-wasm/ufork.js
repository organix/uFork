// JavaScript helpers callable from uFork WASM

export function raw_clock() {
	return performance.now();
}
