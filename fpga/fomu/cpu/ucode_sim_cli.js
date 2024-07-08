// Runs the uCode simulator as a terminal application, hooking up the CPU's I/O
// to STDIN and STDOUT.

// Usage:

//      deno run --allow-read ucode_sim_cli.js <path_to_ucode_file>

/*jslint deno, bitwise */

import ucode from "./ucode.js";
import ucode_sim from "./ucode_sim.js";

const ucode_path = Deno.args[0];
let read_buffer = new Uint8Array(1 << 14); // 16KB
let read_queue = [];
let rx_data = 0x00;
let write_queue = [];
let write_timer;
let writing = false;

function write() {
    const chunk = new Uint8Array(write_queue);
    write_queue = [];
    writing = true;
    Deno.stdout.write(chunk).then(function () {
        writing = false;
    });
}

function rx_ready() {
    return read_queue.length > 0;
}

function rx_fetch() {
    if (rx_ready()) {
        rx_data = read_queue.shift();
    }
    return rx_data;  // infallible read
}

function tx_ready() {
    return !writing;
}

function tx_store(byte) {
    if (!writing) {  // overflow ignored
        write_queue.push(byte);

// Batch the writes to stdout, performing at most one per turn. This prevents
// the simulation running at a crawl.

        clearTimeout(write_timer);
        write_timer = setTimeout(write);
    }
}

// 8-bit UART register interface.

const B_FALSE = 0x00;                                   // 8-bit Boolean FALSE
const B_TRUE = 0xFF;                                    // 8-bit Boolean TRUE

function uc_bool(value) {
    if (value) {
        return B_TRUE;
    }
    return B_FALSE;
}

const TX_RDY = 0x0;                                     // ready to transmit
const TX_DAT = 0x1;                                     // data to transmit
const RX_RDY = 0x2;                                     // receive complete
const RX_DAT = 0x3;                                     // data received

const uart = Object.freeze({
    read(reg) {
        if (reg === TX_RDY) {
            return uc_bool(tx_ready());
        }
        if (reg === RX_RDY) {
            return uc_bool(rx_ready());
        }
        if (reg === RX_DAT) {
            return rx_fetch();
        }
        return 0;  // infallible read
    },
    write(reg, data) {
        if (reg === TX_DAT) {
            tx_store(data);
        }
    }
});

// Read and compile/load the uCode program.

Deno.readTextFile(ucode_path).then(function (text) {
    let errors;
    let prog;
    if (ucode_path.endsWith(".f")) {
        const result = ucode.compile(text, ucode_path);
        errors = result.errors;
        prog = result.prog;
    } else if (ucode_path.endsWith(".mem")) {
        prog = ucode.parse_memh(text, ucode_path);
    } else {
        errors = [{
            error: "unsupported file extension",
            src: ucode_path,
            line: 0
        }];
    }

// Fail if there was a compilation error.

    if (errors !== undefined && errors.length > 0) {
        errors.forEach(function (err) {
            window.console.error(err.src + ":" + err.line + " " + err.error);
        });
        return Deno.exit(1);
    }

// Put terminal in raw-mode so we see all the control characters

    Deno.stdin.setRaw(true);
    function clean_exit(status) {
        Deno.stdin.setRaw(false);  // turn off raw-mode before exit
        return Deno.exit(status);
    }

// Begin consuming STDIN.

    (function read() {
        return Deno.stdin.read(read_buffer).then(function (nr_bytes) {
            if (!Number.isSafeInteger(nr_bytes)) {
                Deno.stdin.setRaw(false);
                return clean_exit(0); // EOF
            }
            read_queue.push(...read_buffer.slice(0, nr_bytes));
            return read();
        });
    }());

// Make a simulator and run it, pausing to handle interrupts every so often.

    let machine = ucode_sim.make_machine(prog, [uart]);
    return (function step(remaining = 1000) {
        const rv = machine.step();
        if (rv !== undefined) {
            window.console.error(rv);
            Deno.stdin.setRaw(false);
            return clean_exit(1);
        }
        return (
            remaining <= 0
            ? setTimeout(step)
            : step(remaining - 1)
        );
    }());
});
