import { Universe, Cell } from "ufork-wasm";
import { memory } from "ufork-wasm/ufork_wasm_bg";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#9CF";
const DEAD_COLOR = "#FFF";
const LIVE_COLOR = "#360";

// Construct the universe, and get its width and height.
const width = 96;
const height = 64;
const universe = Universe.new(width, height);
universe.pattern_fill();
universe.launch_ship();

// Give the canvas room for all of our cells and a 1px border around them.
const $canvas = document.getElementById("ufork-canvas");
$canvas.width = (CELL_SIZE + 1) * width + 1;
$canvas.height = (CELL_SIZE + 1) * height + 1;

const ctx = $canvas.getContext('2d');

let paused = false;  // run/pause toggle

const renderLoop = () => {
	//debugger;
	if (paused) return;

	universe.tick();

	drawGrid();
	drawCells();

	requestAnimationFrame(renderLoop);
}

const drawGrid = () => {
	ctx.beginPath();
	ctx.strokeStyle = GRID_COLOR;

	// Vertical lines.
	for (let i = 0; i <= width; i++) {
		ctx.moveTo(i * (CELL_SIZE + 1) + 1, 0);
		ctx.lineTo(i * (CELL_SIZE + 1) + 1, (CELL_SIZE + 1) * height + 1);
	}

	// Horizontal lines.
	for (let j = 0; j <= height; j++) {
		ctx.moveTo(0,                           j * (CELL_SIZE + 1) + 1);
		ctx.lineTo((CELL_SIZE + 1) * width + 1, j * (CELL_SIZE + 1) + 1);
	}

	ctx.stroke();
};

const getIndex = (row, column) => {
	return row * width + column;
};

const drawCells = () => {
	const cellsPtr = universe.cells();
	const cells = new Uint8Array(memory.buffer, cellsPtr, width * height);

	ctx.beginPath();

	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			const idx = getIndex(row, col);

		ctx.fillStyle =
			cells[idx] === Cell.Dead
			? DEAD_COLOR
			: LIVE_COLOR;

		ctx.fillRect(
			col * (CELL_SIZE + 1) + 1,
			row * (CELL_SIZE + 1) + 1,
			CELL_SIZE,
			CELL_SIZE);
		}
	}

	ctx.stroke();
};

const $pauseButton = document.getElementById("play-pause");

function playAction() {
	$pauseButton.textContent = "Pause";
	$pauseButton.onclick = pauseAction;
	paused = false;
	renderLoop();
}

function pauseAction() {
	$pauseButton.textContent = "Play";
	$pauseButton.onclick = playAction;
	paused = true;
}

// draw initial state
drawGrid();
drawCells();

//playAction();  // start animation (running)
pauseAction();  // start animation (paused)
