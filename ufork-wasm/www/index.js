import init, { Universe, Cell, Host } from "../pkg/ufork_wasm.js";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#9CF";
const DEAD_COLOR = "#FFF";
const LIVE_COLOR = "#360";
const width = 96;
const height = 64;

const $mem_top = document.getElementById("ufork-mem-top");
const $mem_next = document.getElementById("ufork-mem-next");
const $mem_free = document.getElementById("ufork-mem-free");
const $mem_root = document.getElementById("ufork-mem-root");
const $sponsor_memory = document.getElementById("ufork-sponsor-memory");
const $sponsor_events = document.getElementById("ufork-sponsor-events");
const $sponsor_instrs = document.getElementById("ufork-sponsor-instrs");
const $equeue = document.getElementById("ufork-equeue");
const $kqueue = document.getElementById("ufork-kqueue");

const $mem_rom = document.getElementById("ufork-rom");
const $mem_ram = document.getElementById("ufork-ram");

//const $ip = document.getElementById("ufork-ip");
const $instr = document.getElementById("ufork-instr");
//const $sp = document.getElementById("ufork-sp");
const $stack = document.getElementById("ufork-stack");
//const $ep = document.getElementById("ufork-ep");
const $event = document.getElementById("ufork-event");
//const $ap = document.getElementById("ufork-ap");
const $self = document.getElementById("ufork-self");
//const $mp = document.getElementById("ufork-mp");
const $msg = document.getElementById("ufork-msg");

// Give the canvas room for all of our cells and a 1px border around them.
const $canvas = document.getElementById("ufork-canvas");
$canvas.width = (CELL_SIZE + 1) * width + 1;
$canvas.height = (CELL_SIZE + 1) * height + 1;

let memory;
let host;
let universe;
let prepared = false;  // host initialized
let paused = false;  // run/pause toggle
const $rate = document.getElementById("frame-rate");
let frame = 1;  // frame-rate countdown

const updateElementText = (el, txt) => {
	if (el.textContent == txt) {
		el.style.color = '#000';
	} else {
		el.style.color = '#03F';
	}
	el.textContent = txt;
}
const drawHost = () => {
	var a;

	updateElementText($mem_top, host.print(host.mem_top()));
	updateElementText($mem_next, host.print(host.mem_next()));
	$mem_next.title = host.disasm(host.mem_next());
	updateElementText($mem_free, host.print(host.mem_free()));
	updateElementText($mem_root, host.print(host.mem_root()));
	$mem_root.title = host.disasm(host.mem_root());
	updateElementText($sponsor_memory, host.print(host.sponsor_memory()));
	updateElementText($sponsor_events, host.print(host.sponsor_events()));
	updateElementText($sponsor_instrs, host.print(host.sponsor_instrs()));
	//$mem_rom.textContent = host.render();
	a = [];
	for (let addr = 0; addr < 512; addr++) {
		let raw = host.rom_addr(addr);
		let line = '$'
			+ ('00000000' + raw.toString(16)).slice(-8)
			+ ': '
			+ host.display(raw);
		a.push(line);
		$mem_rom.textContent = a.join("\n");
	}
	a = [];
	for (let addr = 0; addr < 512; addr++) {
		let raw = host.ram_addr(host.gc_phase(), addr);
		let line = '$'
			+ ('00000000' + raw.toString(16)).slice(-8)
			+ ': '
			+ host.display(raw);
		a.push(line);
		$mem_ram.textContent = a.join("\n");
	}
	const ip = host.ip();
	//updateElementText($ip, host.print(ip));
	if (host.in_mem(ip)) {
		let p = ip;
		let n = 5;
		let a = [];
		while ((n > 0) && host.in_mem(p)) {
			a.push(host.display(p));
			p = host.next(p);
			n -= 1;
		}
		if (host.in_mem(p)) {
			a.push("...");
		}
		updateElementText($instr, a.join("\n"));
	} else {
		updateElementText($instr, host.display(ip));
	}
	const sp = host.sp();
	//updateElementText($sp, host.print(sp));
	//$sp.title = host.disasm(sp);
	if (host.in_mem(sp)) {
		let p = sp;
		let a = [];
		while (host.is_pair(p)) {
			//a.push(host.disasm(p));  // disasm stack Pair
			//a.push(host.print(host.car(p)));  // print stack item
			//a.push(host.display(host.car(p)));  // display stack item
			a.push(host.pprint(host.car(p)));  // pretty-print stack item
			p = host.cdr(p);
		}
		updateElementText($stack, a.join("\n"));
	} else {
		//$stack.innerHTML = "<i>empty</i>";
		updateElementText($stack, "--");
	}
	$stack.title = host.display(sp);
	const kq = host.kqueue();
	if (host.in_mem(kq)) {
		let p = kq;
		let a = [];
		while (host.in_mem(p)) {
			a.push(host.display(p));  // display continuation
			//a.push(host.disasm(p));  // disasm continuation
			p = host.next(p);
		}
		updateElementText($kqueue, a.join("\n"));
	} else {
		updateElementText($kqueue, "--");
	}
	const eq = host.equeue();
	if (host.in_mem(eq)) {
		let p = eq;
		let a = [];
		while (host.in_mem(p)) {
			a.push(host.display(p));  // display event
			//a.push(host.disasm(p));  // disasm event
			p = host.next(p);
		}
		updateElementText($equeue, a.join("\n"));
	} else {
		updateElementText($equeue, "--");
	}
	const ep = host.ep();
	//updateElementText($ep, host.print(ep));
	updateElementText($event, host.display(ep));
	const ap = host.e_self();
	//updateElementText($ap, host.print(ap));
	updateElementText($self, host.display(ap));
	const mp = host.e_msg();
	//updateElementText($mp, host.print(mp));
	//$mp.title = host.disasm(mp);
	updateElementText($msg, host.pprint(mp));
	$msg.title = host.display(mp);
}
const drawUniverse = () => {
	drawHost();
	drawGrid();
	drawCells();
}
const singleStep = () => {
	if (!prepared) {
		host.prepare();
		prepared = true;
	} else {
		host.step();
	}
	universe.tick();
	drawUniverse();
};
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

const printClick = event => {
	//console.log("printClick:", event);
	const s = event.target.textContent;
	console.log("printClick:", event, s);
}
$mem_root.onclick = printClick;

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
$stepButton.onclick = singleStep;

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

init().then(function (wasm) {
	memory = wasm.memory;
	host = Host.new();
	//host.prepare(); // this is now done in singleStep()
	universe = Universe.new(width, height);
	//universe.pattern_fill();
	universe.launch_ship();

	// draw initial state
	singleStep(); //drawUniverse();

	//playAction();  // start animation (running)
	pauseAction();  // start animation (paused)
});
