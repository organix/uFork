//#![no_std]
//#![feature(default_alloc_error_handler)]
//#![feature(alloc_error_handler)]

extern crate alloc;

use core::cell::RefCell;

use crate::ufork::*;

pub mod ufork;
pub mod device;

/*
#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

#[cfg(target_arch = "wasm32")]
#[global_allocator]
//static ALLOCATOR: lol_alloc::LeakingPageAllocator = lol_alloc::LeakingPageAllocator;
static ALLOCATOR: lol_alloc::AssumeSingleThreaded<lol_alloc::FreeListAllocator> = unsafe {
    lol_alloc::AssumeSingleThreaded::new(lol_alloc::FreeListAllocator::new())
};

#[cfg(target_arch = "wasm32")]
#[alloc_error_handler]
fn out_of_memory(_: core::alloc::Layout) -> ! {
    core::arch::wasm32::unreachable()
}
*/

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "js")]
extern {
    fn host_clock() -> Raw;
    fn host_log(x: Raw);
}

#[cfg(target_arch = "wasm32")]
pub fn greet(msg: Any) {
    unsafe {
        host_log(msg.raw());
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn greet(msg: Any) {
    println!("LOG: {}", msg.raw());
    // FIXME: find a better way to send information to the Host environment
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

#[no_mangle]
pub /*extern "C"*/ fn h_step() -> Error {
    unsafe {
        the_host().borrow_mut().step()
    }
}

#[no_mangle]
pub fn h_gc_run() {
    unsafe {
        the_host().borrow_mut().gc_run()
    }
}

#[no_mangle]
pub fn h_rom_buffer() -> *const Quad {
    unsafe {
        the_host().borrow().rom_buffer()
    }
}

#[no_mangle]
pub fn h_rom_top() -> Raw {
    unsafe {
        the_host().borrow().rom_top()
    }
}

#[no_mangle]
pub fn h_ram_buffer(bank: Raw) -> *const Quad {
    unsafe {
        the_host().borrow().ram_buffer(bank)
    }
}

#[no_mangle]
pub fn h_ram_top() -> Raw {
    unsafe {
        the_host().borrow().ram_top()
    }
}

#[no_mangle]
pub fn h_blob_buffer() -> *const u8 {
    unsafe {
        the_host().borrow().blob_buffer()
    }
}

#[no_mangle]
pub fn h_blob_top() -> Raw {
    unsafe {
        the_host().borrow().blob_top()
    }
}

#[no_mangle]
pub fn h_gc_phase() -> Raw {
    unsafe {
        the_host().borrow().gc_phase()
    }
}

#[no_mangle]
pub fn h_in_mem(raw: Raw) -> bool {
    unsafe {
        the_host().borrow().in_mem(raw)
    }
}

#[no_mangle]
pub fn h_car(raw: Raw) -> Raw {
    unsafe {
        the_host().borrow().car(raw)
    }
}

#[no_mangle]
pub fn h_cdr(raw: Raw) -> Raw {
    unsafe {
        the_host().borrow().cdr(raw)
    }
}

#[no_mangle]
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
    fn step(&mut self) -> Error {  // single-step instruction execution
        match self.core.execute_instruction() {
            Ok(more) => {
                if !more && !self.core.event_pending() {
                    //log!("continuation queue empty!");
                    return E_FAIL;  // no more instructions...
                }
            },
            Err(error) => {
                //log!("execution ERROR! {}", _error);
                return error;  // execute instruction failed...
            },
        }
        if let Err(error) = self.core.check_for_interrupt() {
            //log!("interrupt ERROR! {}", error);
            return error;  // interrupt handler failed...
        }
        if let Err(error) = self.core.dispatch_event() {
            //log!("dispatch ERROR! {}", error);
            return error;  // event dispatch failed...
        }
        E_OK  // step successful
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
     *  to provide access (read/write) to WASM Host.
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
