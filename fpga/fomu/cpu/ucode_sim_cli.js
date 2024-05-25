// Runs the uCode simulator as a terminal application, hooking up the CPI's I/O
// to STDIN and STDOUT. Stop it will ^D.

// Usage:

//      deno run --allow-read ucode_sim_cli.js <path_to_ucode_file>

/*jslint deno */

import ucode from "./ucode.js";
import ucode_sim from "./ucode_sim.js";

const ucode_path = Deno.args[0];
let read_buffer = new Uint8Array(65536); // 64KB
let stdin_queue = [];
let writing = false;
const io_device = Object.freeze({
    rx_ready() {
        return stdin_queue.length > 0;
    },
    rx_fetch() {
        if (stdin_queue.length === 0) {
            throw new Error("Exhausted.");
        }
        return stdin_queue.shift();
    },
    tx_ready() {
        return !writing;
    },
    tx_store(byte) {
        if (writing) {
            throw new Error("Busy.");
        }
        writing = true;
        const chunk = new Uint8Array([byte]);
        Deno.stdout.write(chunk).then(function () {
            writing = false;
        });
    }
});

// Read and compile the uCode program.

Deno.readTextFile(ucode_path).then(function (text) {
    const {errors, prog} = ucode.compile(text);

// Fail if there was a compilation error.

    if (errors !== undefined && errors.length > 0) {
        errors.forEach(function (err) {
            window.console.error(err.src + ":" + err.line + " " + err.error);
        });
        return Deno.exit(1);
    }

// Begin consuming STDIN.

    (function read() {
        return Deno.stdin.read(read_buffer).then(function (nr_bytes) {
            if (!Number.isSafeInteger(nr_bytes)) {
                return Deno.exit(0); // EOF
            }
            stdin_queue.push(...read_buffer.slice(0, nr_bytes));
            return read();
        });
    }());

// Make a simulator and run it in such a way as to not block STDIN.

    let machine = ucode_sim.make_machine(prog, io_device);

//mock machine = {
//mock     step() {
//mock         if (Math.random() < 0.001 && io_device.rx_ready()) {
//mock             window.console.log("RX@", io_device.rx_fetch());
//mock         }
//mock         if (Math.random() < 0.001 && io_device.tx_ready()) {
//mock             io_device.tx_store(Math.floor(Math.random() * 256));
//mock         }
//mock     }
//mock };

    return (function step(rv) {
        if (rv !== undefined) {
            window.console.error(rv);
            return Deno.exit(1);
        }
        return setTimeout(step, 0, machine.step());
    }());
});
