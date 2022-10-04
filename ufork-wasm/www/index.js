import { Universe, Cell, Host } from "ufork-wasm";
import { memory } from "ufork-wasm/ufork_wasm_bg";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#9CF";
const DEAD_COLOR = "#FFF";
const LIVE_COLOR = "#360";

// Construct the universe, and get its width and height.
const width = 24;//96;
const height = 16;//64;
const universe = Universe.new(width, height);
//universe.pattern_fill();
universe.launch_ship();

const host = Host.new();
host.prepare();

// Give the canvas room for all of our cells and a 1px border around them.
const $canvas = document.getElementById("ufork-canvas");
$canvas.width = (CELL_SIZE + 1) * width + 1;
$canvas.height = (CELL_SIZE + 1) * height + 1;

const $output = document.getElementById("ufork-output");
const $ip = document.getElementById("ufork-ip");
const $instr = document.getElementById("ufork-instr");
const $sp = document.getElementById("ufork-sp");
const $stack = document.getElementById("ufork-stack");
const $ep = document.getElementById("ufork-ep");
const $event = document.getElementById("ufork-event");

let paused = false;  // run/pause toggle
const $rate = document.getElementById("frame-rate");
let frame = 1;  // frame-rate countdown

const drawHost = () => {
	$output.textContent = host.render();
	const ip = host.ip();
	$ip.textContent = "" + ip;
	$instr.textContent = host.disasm(ip);
	const sp = host.sp();
	$sp.textContent = "" + sp;
	if (host.in_heap(sp)) {
		let p = sp;
		let a = [];
		while (host.is_pair(p)) {
			//a.push(host.disasm(p));  // display stack Pair(s)
			a.push(host.print(host.car(p)));  // display stack item(s)
			p = host.cdr(p);
		}
		$stack.textContent = a.join("\n");
	} else {
		$stack.innerHTML = "<i>empty</i>";
	}
	const ep = host.ep();
	$ep.textContent = "" + ep;
	$event.textContent = host.disasm(ep);
}
const drawUniverse = () => {
	drawHost();
	drawGrid();
	drawCells();
}
const singleStep = () => {
	host.step();
	universe.tick();
	drawUniverse();
}
const renderLoop = () => {
	//debugger;
	if (paused) return;

	if (--frame > 0) {
		// skip this frame update
	} else {
		frame = +($rate.value);
		singleStep();
	}
	requestAnimationFrame(renderLoop);
}

$canvas.onclick = event => {
	const boundingRect = $canvas.getBoundingClientRect();

	const scaleX = $canvas.width / boundingRect.width;
	const scaleY = $canvas.height / boundingRect.height;

	const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
	const canvasTop = (event.clientY - boundingRect.top) * scaleY;

	const row = Math.min(Math.floor(canvasTop / (CELL_SIZE + 1)), height - 1);
	const col = Math.min(Math.floor(canvasLeft / (CELL_SIZE + 1)), width - 1);

	universe.toggle_cell(row, col);
	drawUniverse();
}

const ctx = $canvas.getContext('2d');

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
}

const getIndex = (row, column) => {
	return row * width + column;
}

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
}

const $clearButton = document.getElementById("clear-btn");
$clearButton.onclick = () => {
	universe.clear_grid();
	drawUniverse();
}

const $gliderButton = document.getElementById("glider-btn");
$gliderButton.onclick = () => {
	universe.launch_ship();
	drawUniverse();
}

const $rPentominoButton = document.getElementById("r-pentomino-btn");
$rPentominoButton.onclick = () => {
	universe.r_pentomino();
	drawUniverse();
}

const $acornButton = document.getElementById("acorn-btn");
$acornButton.onclick = () => {
	universe.plant_acorn();
	drawUniverse();
}

const $gosperButton = document.getElementById("gosper-btn");
$gosperButton.onclick = () => {
	universe.gosper_gun();
	drawUniverse();
}

const $patternButton = document.getElementById("pattern-btn");
$patternButton.onclick = () => {
	universe.pattern_fill();
	drawUniverse();
}

const $randomButton = document.getElementById("random-btn");
$randomButton.onclick = () => {
	universe.random_fill();
	drawUniverse();
}

const $stepButton = document.getElementById("single-step");
$stepButton.onclick = () => {
	singleStep();
}

const $pauseButton = document.getElementById("play-pause");
const playAction = () => {
	$pauseButton.textContent = "Pause";
	$pauseButton.onclick = pauseAction;
	paused = false;
	$stepButton.disabled = true;
	renderLoop();
}
const pauseAction = () => {
	$pauseButton.textContent = "Play";
	$pauseButton.onclick = playAction;
	$stepButton.disabled = false;
	paused = true;
}

// draw initial state
drawUniverse();

//playAction();  // start animation (running)
pauseAction();  // start animation (paused)
