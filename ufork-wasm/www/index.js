import { Universe } from "ufork-wasm";

const $canvas = document.getElementById("ufork-canvas");
const universe = Universe.new();

const renderLoop = () => {
	$canvas.textContent = universe.render();
	universe.tick();

	requestAnimationFrame(renderLoop);
}

requestAnimationFrame(renderLoop);  // start animation
