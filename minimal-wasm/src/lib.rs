#![no_std]

use core::panic::PanicInfo;
use core::arch::wasm32::unreachable;

// The 'double' function is a JavaScript function, provided as an import.

#[link(wasm_import_module = "imports")]
extern {
    fn double(x: u32) -> u32;
}

// The 'call_double' function is exported, and can be called from JavaScript.

#[no_mangle]
pub fn call_double(x: u32) -> u32 {
    unsafe {
        double(x)
    }
}

// In no_std mode we must handle panics ourselves. The simplest strategy is to
// jump to WASM's 'unreachable' instruction, causing execution to cease. If a
// debugger is attached, it will display a stack trace of preceeding WASM
// instructions.

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unreachable()
}
