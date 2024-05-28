// Runs the uCode simulator as a terminal application, hooking up the CPI's I/O
// to STDIN and STDOUT. Stop it will ^D.

// Usage:

//      deno run --allow-read ucode_sim_cli.js <path_to_ucode_file>

/*jslint deno */

import ucode from "./ucode.js";
import ucode_sim from "./ucode_sim.js";

const ucode_path = Deno.args[0];
let read_buffer = new Uint8Array(1<<14); // 16KB
let rx_data = 0x00;
let stdin_queue = [];
let writing = false;
function rx_ready() {
    return stdin_queue.length > 0;
}
function rx_fetch() {
    if (rx_ready()) {
        rx_data = stdin_queue.shift();
    }
    return rx_data;  // infallible read
}
function tx_ready() {
    return !writing;
}
function tx_store(byte) {
    if (!writing) {  // overflow ignored
        writing = true;
        const chunk = new Uint8Array([byte]);
        Deno.stdout.write(chunk).then(function () {
            writing = false;
        });
    }
}
const io_device = Object.freeze({
    rx_ready,
    rx_fetch,
    tx_ready,
    tx_store,
});

// 8-bit UART register interface.

const B_FALSE =             0x00;                       // 8-bit Boolean FALSE
const B_TRUE =              0xFF;                       // 8-bit Boolean TRUE

const TX_RDY =              0x0;                        // ready to transmit
const TX_DAT =              0x1;                        // data to transmit
const RX_RDY =              0x2;                        // receive complete
const RX_DAT =              0x3;                        // data received

const uart = Object.freeze({
    read(reg) {
        if (reg === TX_RDY) {
            return (tx_ready() ? B_TRUE : B_FALSE);
        }
        if (reg === RX_RDY) {
            return (rx_ready() ? B_TRUE : B_FALSE);
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
    },
})

// Read and compile/load the uCode program.

Deno.readTextFile(ucode_path).then(function (text) {
    let errors, prog;
    if (ucode_path.endsWith(".f")) {
        ({errors, prog} = ucode.compile(text, ucode_path));
    } else if (ucode_path.endsWith(".mem")) {
        prog = ucode.parse_memh(text, ucode_path);
    } else {
        errors = [{error: "unsupported file extension", src: ucode_path, line: 0}];
    }

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

    let machine = ucode_sim.make_machine(prog, [uart]);

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
