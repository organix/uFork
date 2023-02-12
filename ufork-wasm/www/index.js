import init, {
    Universe, Cell, Host,
    h_step, h_gc_run, h_rom_buffer, h_ram_buffer,
    h_gc_phase, h_in_mem, h_car, h_cdr, h_next,
    h_rom_top, h_ram_top, h_ram_next, h_ram_free, h_ram_root,
} from "../pkg/ufork_wasm.js";

const CELL_SIZE = 5; // px
const GRID_COLOR = "#9CF";
const DEAD_COLOR = "#FFF";
const LIVE_COLOR = "#360";
const width = 96;
const height = 64;

const $mem_max = document.getElementById("ufork-mem-max");
const $mem_top = document.getElementById("ufork-mem-top");
const $mem_next = document.getElementById("ufork-mem-next");
const $mem_free = document.getElementById("ufork-mem-free");
const $mem_root = document.getElementById("ufork-mem-root");
const $gc_phase = document.getElementById("ufork-gc-phase");
const $sponsor_memory = document.getElementById("ufork-sponsor-memory");
const $sponsor_events = document.getElementById("ufork-sponsor-events");
const $sponsor_instrs = document.getElementById("ufork-sponsor-instrs");
const $equeue = document.getElementById("ufork-equeue");
const $kqueue = document.getElementById("ufork-kqueue");

const $mem_rom = document.getElementById("ufork-rom");
const $mem_ram = document.getElementById("ufork-ram");

const $instr = document.getElementById("ufork-instr");
const $stack = document.getElementById("ufork-stack");
const $event = document.getElementById("ufork-event");
const $self = document.getElementById("ufork-self");
const $msg = document.getElementById("ufork-msg");

const $fault = document.getElementById("fault-led");

// Give the canvas room for all of our cells and a 1px border around them.
const $canvas = document.getElementById("ufork-canvas");
$canvas.width = (CELL_SIZE + 1) * width + 1;
$canvas.height = (CELL_SIZE + 1) * height + 1;

let memory;
//let host;
let universe;
let paused = false;  // run/pause toggle
let fault = false;  // execution fault flag
const $rate = document.getElementById("frame-rate");
let frame = 1;  // frame-rate countdown
let ram_max = 0;

// type-tag bits
const MSK_RAW   = 0xF000_0000;  // mask for type-tag bits
const DIR_RAW   = 0x8000_0000;  // 1=direct (fixnum), 0=indirect (pointer)
const OPQ_RAW   = 0x4000_0000;  // 1=opaque (capability), 0=transparent (navigable)
const MUT_RAW   = 0x2000_0000;  // 1=read-write (mutable), 0=read-only (immutable)
const BNK_RAW   = 0x1000_0000;  // 1=bank_1, 0=bank_0 (half-space GC phase)
const BNK_0_RAW = 0;
const BNK_1_RAW = BNK_RAW;
// raw constants
const UNDEF_RAW = 0x0000_0000;
const NIL_RAW   = 0x0000_0001;
const FALSE_RAW = 0x0000_0002;
const TRUE_RAW  = 0x0000_0003;
const UNIT_RAW 	= 0x0000_0004;
// ram offets
const MEMORY_OFS = 0;
const DDEQUE_OFS = 1;
// helper functions
function h_warning(message) {
    console.log("WARNING!", message);
    return UNDEF_RAW;
}
function h_is_fix(raw) {
    return ((raw & DIR_RAW) !== 0);
}
function h_is_cap(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW)) === OPQ_RAW);
}
function h_is_ptr(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW)) === 0);
}
function h_is_rom(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW | MUT_RAW)) === 0);
}
function h_is_ram(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW | MUT_RAW)) === MUT_RAW);
}
function h_fixnum(i32) {
    return ((i32 | DIR_RAW) >>> 0);
}
function h_rawofs(raw) {
    return (raw & ~MSK_RAW);
}
function h_romptr(ofs) {
    return h_rawofs(ofs);
}
function h_ramptr(ofs, bnk) {
    if (typeof bnk !== "number") {
        bnk = h_gc_phase();
    }
    return (h_rawofs(ofs) | MUT_RAW | bnk);
}
function h_cap_to_ptr(cap) {
    return (h_is_fix(cap)
        ? h_warning("cap_to_ptr: can't convert fixnum "+h_print(cap))
        : (cap & ~OPQ_RAW));
}
function h_ptr_to_cap(ptr) {
    return (h_is_fix(ptr)
        ? h_warning("ptr_to_cap: can't convert fixnum "+h_print(ptr))
        : (ptr | OPQ_RAW));
}
function h_fix_to_i32(fix) {
    return (fix << 1) >> 1;
}
let h_read_quad = function(ptr) {
    return h_warning("h_read_quad: WASM not initialized.");
};
let h_write_quad = function(ptr, quad) {
    return h_warning("h_write_quad: WASM not initialized.");
};
const rom_label = [
    "#?",
    "()",
    "#f",
    "#t",
    "#unit",
    "TYPE_T",
    "GC_FWD_T",
    "INSTR_T",
    "ACTOR_T",
    "FIXNUM_T",
    "SYMBOL_T",
    "PAIR_T",
    "DICT_T",
    "PROXY_T",
    "STUB_T",
    "FREE_T"
];
function h_print(raw) {
    if (typeof raw !== "number") {
        return "" + raw;
    }
    if (h_is_fix(raw)) {  // fixnum
        const i32 = h_fix_to_i32(raw);
        if (i32 < 0) {
            return "" + i32;
        } else {
            return "+" + i32;
        }
    }
    if (raw < rom_label.length) {
        return rom_label[raw];
    }
    const prefix = (raw & OPQ_RAW) ? "@" : "^";
    return prefix + ("00000000" + raw.toString(16)).slice(-8);
}
function q_print(quad) {
    return ("{ "+
        "t:"+h_print(quad.t)+", "+
        "x:"+h_print(quad.x)+", "+
        "y:"+h_print(quad.y)+", "+
        "z:"+h_print(quad.z)+" }");
}
function h_disasm(ptr) {
    let str = h_print(ptr);
    if (h_is_cap(ptr)) {
        ptr = h_cap_to_ptr(ptr);
    }
    if (h_is_ptr(ptr)) {
        str += ": ";
        const quad = h_read_quad(ptr);
        str += q_print(quad);
    }
    return str;
}

const updateElementText = (el, txt) => {
    if (el.textContent == txt) {
        el.style.color = '#000';
    } else {
        el.style.color = '#03F';
    }
    el.textContent = txt;
}
function updateRomMonitor() {
    let a = [];
    for (let ofs = 0; ofs < h_rawofs(h_rom_top()); ofs += 1) {
        const ptr = h_romptr(ofs);
        const quad = h_read_quad(ptr);
        const line = ("         " + h_print(ptr)).slice(-9)
            + ": " + q_print(quad);
        a.push(line);
    }
    $mem_rom.textContent = a.join("\n");
}
function updateRamMonitor() {
    let a = [];
    for (let ofs = 0; ofs < h_rawofs(h_ram_top()); ofs += 1) {
        const ptr = h_ramptr(ofs);
        const line = h_disasm(ptr);
        a.push(line);
    }
    $mem_ram.textContent = a.join("\n");
}
const drawHost = () => {
    if (fault) {
        $fault.setAttribute("fill", "#F30");
        $fault.setAttribute("stroke", "#900");
    } else {
        $fault.setAttribute("fill", "#0F3");
        $fault.setAttribute("stroke", "#090");
    }
    updateRamMonitor();
    const top = h_rawofs(h_ram_top());
    if (top > ram_max) {
        ram_max = top;
    }
    updateElementText($mem_max, ram_max.toString());
    updateElementText($mem_top, h_print(h_ram_top()));
    updateElementText($mem_next, h_print(h_ram_next()));
    //$mem_next.title = h_disasm(h_ram_next());
    updateElementText($mem_free, h_print(h_ram_free()));
    updateElementText($mem_root, h_print(h_ram_root()));
    //$mem_root.title = h_disasm(h_ram_root());
    updateElementText($gc_phase, h_gc_phase() == 0 ? "Bank 0" : "Bank 1");
    const ddqeue_quad = h_read_quad(h_ramptr(DDEQUE_OFS));
    const e_first = ddqeue_quad.t;
    const e_last = ddqeue_quad.x;
    const k_first = ddqeue_quad.y;
    const k_last = ddqeue_quad.z;
    if (h_in_mem(k_first)) {
        let p = k_first;
        let a = [];
        while (h_in_mem(p)) {
            a.push(h_disasm(p));  // disasm continuation
            p = h_next(p);
        }
        updateElementText($kqueue, a.join("\n"));
    } else {
        updateElementText($kqueue, "--");
    }
    if (h_in_mem(e_first)) {
        let p = e_first;
        let a = [];
        while (h_in_mem(p)) {
            a.push(h_disasm(p));  // disasm event
            p = h_next(p);
        }
        updateElementText($equeue, a.join("\n"));
    } else {
        updateElementText($equeue, "--");
    }
    const cont_quad = h_read_quad(k_first);
    const ip = cont_quad.t;
    const sp = cont_quad.x;
    const ep = cont_quad.y;
    if (h_in_mem(ip)) {
        let p = ip;
        let n = 5;
        let a = [];
        while ((n > 0) && h_in_mem(p)) {
            a.push(h_disasm(p));
            p = h_next(p);
            n -= 1;
        }
        if (h_in_mem(p)) {
            a.push("...");
        }
        updateElementText($instr, a.join("\n"));
    } else {
        updateElementText($instr, "--");
    }
    if (h_in_mem(sp)) {
        let p = sp;
        let a = [];
        while (h_in_mem(p)) {
            //a.push(h_disasm(p));  // disasm stack Pair
            a.push(h_print(h_car(p)));  // print stack item
            //a.push(h_pprint(h_car(p)));  // pretty-print stack item
            p = h_cdr(p);
        }
        updateElementText($stack, a.join("\n"));
    } else {
        updateElementText($stack, "--");
    }
    $stack.title = h_disasm(sp);
    updateElementText($event, h_disasm(ep));
    const event_quad = h_read_quad(ep);
    const sponsor = event_quad.t;
    const target = event_quad.x;
    const message = event_quad.y;
    const rollback =  event_quad.z;
    updateElementText($self, h_disasm(target));
    updateElementText($msg, h_disasm(message));
    const sponsor_quad = h_read_quad(sponsor);
    updateElementText($sponsor_memory, h_print(sponsor_quad.t));
    updateElementText($sponsor_events, h_print(sponsor_quad.x));
    updateElementText($sponsor_instrs, h_print(sponsor_quad.y));
}
const drawUniverse = () => {
    drawHost();
    drawGrid();
    drawCells();
}
const gcHost = () => {
    h_gc_run();
    drawUniverse();
}
const singleStep = () => {
    const ok = h_step();
    fault = !ok;
    universe.tick();
    drawUniverse();
    return ok;
};
const renderLoop = () => {
    //debugger;
    if (paused) return;

    if (--frame > 0) {
        // skip this frame update
    } else {
        frame = +($rate.value);
        if (singleStep() == false) {  // pause on fault signal
            pauseAction();
            return;
        }
    }
    requestAnimationFrame(renderLoop);
}

const logClick = event => {
    //console.log("logClick:", event);
    const s = event.target.textContent;
    console.log("logClick:", event, s);
}
//$mem_root.onclick = logClick;

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

const $gcButton = document.getElementById("ufork-gc-btn");
$gcButton.onclick = gcHost;

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
    h_read_quad = function(ptr) {
        if (h_is_ram(ptr)) {
            // WARNING! The WASM memory buffer can move if it is resized.
            //          We get a fresh pointer each time for safety.
            const ofs = h_rawofs(ptr);
            const ram_ofs = h_ram_buffer(h_gc_phase());
            const ram_top = h_rawofs(h_ram_top());
            if (ofs < ram_top) {
                const ram_len = ram_top << 2;
                const ram = new Uint32Array(wasm.memory.buffer, ram_ofs, ram_len);
                const idx = ofs << 2;  // convert quad address to Uint32Array index
                const quad = {
                    t: ram[idx + 0],
                    x: ram[idx + 1],
                    y: ram[idx + 2],
                    z: ram[idx + 3]
                };
                return quad;
            } else {
                return h_warning("h_read_quad: RAM ptr out of bounds "+h_print(ptr));
            }
        }
        if (h_is_rom(ptr)) {
            // WARNING! The WASM memory buffer can move if it is resized.
            //          We get a fresh pointer each time for safety.
            const ofs = h_rawofs(ptr);
            const rom_ofs = h_rom_buffer();
            const rom_top = h_rawofs(h_rom_top());
            if (ofs < rom_top) {
                const rom_len = rom_top << 2;
                const rom = new Uint32Array(wasm.memory.buffer, rom_ofs, rom_len);
                const idx = ofs << 2;  // convert quad address to Uint32Array index
                const quad = {
                    t: rom[idx + 0],
                    x: rom[idx + 1],
                    y: rom[idx + 2],
                    z: rom[idx + 3]
                };
                return quad;
            } else {
                return h_warning("h_read_quad: ROM ptr out of bounds "+h_print(ptr));
            }
        }
        return h_warning("h_read_quad: required ptr, got "+h_print(ptr));
    };
    h_write_quad = function(ptr, quad) {
        if (h_is_ram(ptr)) {
            // WARNING! The WASM memory buffer can move if it is resized.
            //          We get a fresh pointer each time for safety.
            const ram_ofs = h_ram_buffer(h_gc_phase());
            const ram_top = h_rawofs(h_ram_top());
            if (ofs < ram_top) {
                const ram_len = ram_top << 2;
                const ram = new Uint32Array(wasm.memory.buffer, ram_ofs, ram_len);
                const ofs = h_rawofs(ptr);
                const idx = ofs << 2;  // convert quad address to Uint32Array index
                ram[idx + 0] = quad.t;
                ram[idx + 1] = quad.x;
                ram[idx + 2] = quad.y;
                ram[idx + 3] = quad.z;
            } else {
                return h_warning("h_write_quad: RAM ptr out of bounds "+h_print(ptr));
            }
        }
        return h_warning("h_write_quad: required RAM ptr, got "+h_print(ptr));
    };
    test_suite(wasm);

    memory = wasm.memory;
    //host = Host.new();  // FIXME: remove this in favor of static singleton `Host`
    updateRomMonitor();

    universe = Universe.new(width, height);
    //universe.pattern_fill();
    universe.launch_ship();

    // draw initial state
    drawUniverse();

    //playAction();  // start animation (running)
    pauseAction();  // start animation (paused)
});

function test_suite(wasm) {
    console.log("h_fixnum(0) =", h_fixnum(0), h_fixnum(0).toString(16), h_print(h_fixnum(0)));
    console.log("h_fixnum(1) =", h_fixnum(1), h_fixnum(1).toString(16), h_print(h_fixnum(1)));
    console.log("h_fixnum(-1) =", h_fixnum(-1), h_fixnum(-1).toString(16), h_print(h_fixnum(-1)));
    console.log("h_fixnum(-2) =", h_fixnum(-2), h_fixnum(-2).toString(16), h_print(h_fixnum(-2)));
    console.log("h_rom_top() =", h_rom_top(), h_print(h_rom_top()));
    console.log("h_ram_top() =", h_ram_top(), h_print(h_ram_top()));
    console.log("h_ram_next() =", h_ram_next(), h_print(h_ram_next()));
    console.log("h_ram_free() =", h_ram_free(), h_print(h_ram_free()));
    console.log("h_ram_root() =", h_ram_root(), h_print(h_ram_root()));
    console.log("h_ramptr(5) =", h_ramptr(5), h_print(h_ramptr(5)));
    console.log("h_ptr_to_cap(h_ramptr(3)) =", h_ptr_to_cap(h_ramptr(3)), h_print(h_ptr_to_cap(h_ramptr(3))));

    const rom_ofs = h_rom_buffer();
    const rom = new Uint32Array(wasm.memory.buffer, rom_ofs, (h_rawofs(h_rom_top()) << 2));
    console.log("ROM:", rom);

    const ram_ofs = h_ram_buffer(h_gc_phase());
    const ram = new Uint32Array(wasm.memory.buffer, ram_ofs, (h_rawofs(h_ram_top()) << 2));
    console.log("RAM:", ram);
}
