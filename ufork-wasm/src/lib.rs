/*
#![no_std]
use core::panic::PanicInfo;
#[cfg(target_arch = "wasm32")]
use core::arch::wasm32::unreachable;
#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unreachable()
}
*/

pub mod ufork;
pub mod device;

// FIXME: `use js_sys;` instead?
extern crate js_sys;
extern crate web_sys;

use wasm_bindgen::prelude::*;
use core::cell::RefCell;

use crate::ufork::*;

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern {
    fn alert(s: &str);
}
#[cfg(not(target_arch = "wasm32"))]
pub fn alert(s: &str) {
    println!("alert: {}", s);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}!", name));
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(module = "/ufork.js")]
extern {
    fn raw_clock() -> Raw;
}

unsafe fn the_host() -> &'static RefCell<Host> {
    static mut THE_HOST: Option<RefCell<Host>> = None;

    match &THE_HOST {
        Some(host) => host,
        None => {
            THE_HOST = Some(RefCell::new(Host::new()));
            the_host()
        },
    }
}

#[wasm_bindgen]
pub fn h_step() -> bool {
    unsafe {
        the_host().borrow_mut().step()
    }
}

#[wasm_bindgen]
pub fn h_gc_run() {
    unsafe {
        the_host().borrow_mut().gc_run()
    }
}

#[wasm_bindgen]
pub fn h_rom_buffer() -> *const Quad {
    unsafe {
        the_host().borrow().rom_buffer()
    }
}

#[wasm_bindgen]
pub fn h_rom_top() -> Raw {
    unsafe {
        the_host().borrow().rom_top()
    }
}

#[wasm_bindgen]
pub fn h_ram_buffer(bank: Raw) -> *const Quad {
    unsafe {
        the_host().borrow().ram_buffer(bank)
    }
}

#[wasm_bindgen]
pub fn h_ram_top() -> Raw {
    unsafe {
        the_host().borrow().ram_top()
    }
}

#[wasm_bindgen]
pub fn h_blob_buffer() -> *const u8 {
    unsafe {
        the_host().borrow().blob_buffer()
    }
}

#[wasm_bindgen]
pub fn h_blob_top() -> Raw {
    unsafe {
        the_host().borrow().blob_top()
    }
}

#[wasm_bindgen]
pub fn h_gc_phase() -> Raw {
    unsafe {
        the_host().borrow().gc_phase()
    }
}

#[wasm_bindgen]
pub fn h_in_mem(raw: Raw) -> bool {
    unsafe {
        the_host().borrow().in_mem(raw)
    }
}

#[wasm_bindgen]
pub fn h_car(raw: Raw) -> Raw {
    unsafe {
        the_host().borrow().car(raw)
    }
}

#[wasm_bindgen]
pub fn h_cdr(raw: Raw) -> Raw {
    unsafe {
        the_host().borrow().cdr(raw)
    }
}

#[wasm_bindgen]
pub fn h_next(raw: Raw) -> Raw {
    unsafe {
        the_host().borrow().next(raw)
    }
}

/*
 * JavaScript interface adapter for ufork::Core
 */
struct Host {
    core: Core,
}
impl Host {
    fn new() -> Host {
        let core = Core::new();
        Host {
            core,
        }
    }
    fn step(&mut self) -> bool {  // single-step instruction execution
        match self.core.execute_instruction() {
            Ok(more) => {
                if !more && !self.core.event_pending() {
                    log!("continuation queue empty!");
                    return false;  // no more instructions...
                }
            },
            Err(error) => {
                log!("execution ERROR! {}", error);
                return false;  // execute instruction failed...
            },
        }
        if let Err(error) = self.core.check_for_interrupt() {
            log!("interrupt ERROR! {}", error);
            return false;  // interrupt handler failed...
        }
        if let Err(error) = self.core.dispatch_event() {
            log!("dispatch ERROR! {}", error);
            return false;  // event dispatch failed...
        }
        true  // step successful
    }

    fn gc_phase(&self) -> Raw { self.core.gc_phase() }
    fn gc_run(&mut self) { self.core.gc_stop_the_world() }
    fn rom_top(&self) -> Raw { self.core.rom_top().raw() }
    fn ram_top(&self) -> Raw { self.core.ram_top().raw() }
    fn blob_top(&self) -> Raw { self.core.blob_top().raw() }
    fn in_mem(&self, v: Raw) -> bool {  // excludes built-in constants and types
        (v > FREE_T.raw()) && !Any::new(v).is_fix()
    }
    fn car(&self, p: Raw) -> Raw {
        self.core.car(Any::new(p)).raw()
    }
    fn cdr(&self, p: Raw) -> Raw {
        self.core.cdr(Any::new(p)).raw()
    }
    fn next(&self, p: Raw) -> Raw {
        self.core.next(Any::new(p)).raw()
    }

    /*
     *  WARNING! The methods below give _unsafe_ access
     *  to the underlying buffers. They are intended
     *  to provide access (read/write) to JavaScript.
     */
    fn rom_buffer(&self) -> *const Quad {
        self.core.rom_buffer().as_ptr()
    }
    fn ram_buffer(&self, bank: Raw) -> *const Quad {
        self.core.ram_buffer(bank).as_ptr()
    }
    fn blob_buffer(&self) -> *const u8 {
        self.core.blob_buffer().as_ptr()
    }
}
