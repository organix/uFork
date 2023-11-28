#![no_std]

use ::core::cell::RefCell;

pub mod host;

use ufork::{any::Any, quad::Quad, Error, Raw};

use crate::host::*;

#[panic_handler]
#[cfg(not(test))]
fn panic(_: &::core::panic::PanicInfo) -> ! {
    ::core::unreachable!()
}

//static ALLOCATOR: lol_alloc::LeakingPageAllocator = lol_alloc::LeakingPageAllocator;
#[global_allocator]
#[cfg(target_arch="wasm32")]
static ALLOCATOR: lol_alloc::AssumeSingleThreaded<lol_alloc::FreeListAllocator> =
    unsafe { lol_alloc::AssumeSingleThreaded::new(lol_alloc::FreeListAllocator::new()) };

/*
#[cfg(target_arch = "wasm32")]
#[alloc_error_handler]
fn out_of_memory(_: ::core::alloc::Layout) -> ! {
    ::core::arch::wasm32::unreachable()
}
*/

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host_clock() -> Raw;
    pub fn host_random(a: Raw, b: Raw) -> Raw;
    pub fn host_print(base: *const u8, ofs: usize);
    pub fn host_log(x: Raw);
    pub fn host_start_timer(delay: Raw, stub: Raw);
    pub fn host_stop_timer(stub: Raw) -> bool;
    pub fn host_write(code: Raw) -> Raw;
    pub fn host_read(stub: Raw) -> Raw;
    pub fn host_trace(event: Raw);
    pub fn host(event_stub_or_proxy: Raw) -> Error;
}

// trace transactional effect(s)
#[cfg(target_arch = "wasm32")]
pub fn trace_event(ep: Any, _kp: Any) {
    unsafe {
        host_trace(ep.raw());
    }
}
#[cfg(not(target_arch = "wasm32"))]
pub fn trace_event(ep: Any, _kp: Any) {
    // event tracing not available
    let _ = ep; // place a breakpoint on this assignment
}

unsafe fn the_host() -> &'static RefCell<Host> {
    static mut THE_HOST: Option<RefCell<Host>> = None;

    match &THE_HOST {
        Some(host) => host,
        None => {
            THE_HOST = Some(RefCell::new(Host::new()));
            the_host()
        }
    }
}

#[no_mangle]
pub fn h_run_loop(limit: i32) -> Raw {
    unsafe { the_host().borrow_mut().run_loop(limit) }
}

#[no_mangle]
pub fn h_event_enqueue(evt: Raw) {
    unsafe { the_host().borrow_mut().event_enqueue(evt) }
}

#[no_mangle]
pub fn h_revert() -> bool {
    unsafe { the_host().borrow_mut().actor_revert() }
}

#[no_mangle]
pub fn h_gc_run() {
    unsafe { the_host().borrow_mut().gc_run() }
}

#[no_mangle]
pub fn h_rom_buffer() -> *const Quad {
    unsafe { the_host().borrow().rom_buffer() }
}

#[no_mangle]
pub fn h_rom_top() -> Raw {
    unsafe { the_host().borrow().rom_top() }
}

#[no_mangle]
pub fn h_set_rom_top(top: Raw) {
    unsafe { the_host().borrow_mut().set_rom_top(top) }
}

#[no_mangle]
pub fn h_reserve_rom() -> Raw {
    unsafe { the_host().borrow_mut().reserve_rom() }
}

#[no_mangle]
pub fn h_ram_buffer() -> *const Quad {
    unsafe { the_host().borrow().ram_buffer() }
}

#[no_mangle]
pub fn h_ram_top() -> Raw {
    unsafe { the_host().borrow().ram_top() }
}

#[no_mangle]
pub fn h_reserve() -> Raw {
    unsafe { the_host().borrow_mut().reserve() }
}

#[no_mangle]
pub fn h_reserve_stub(device: Raw, target: Raw) -> Raw {
    unsafe { the_host().borrow_mut().reserve_stub(device, target) }
}

#[no_mangle]
pub fn h_release_stub(ptr: Raw) {
    unsafe { the_host().borrow_mut().release_stub(ptr) }
}

#[no_mangle]
pub fn h_blob_buffer() -> *const u8 {
    unsafe { the_host().borrow().blob_buffer() }
}

#[no_mangle]
pub fn h_blob_top() -> Raw {
    unsafe { the_host().borrow().blob_top() }
}

#[no_mangle]
pub fn h_car(raw: Raw) -> Raw {
    unsafe { the_host().borrow().car(raw) }
}

#[no_mangle]
pub fn h_cdr(raw: Raw) -> Raw {
    unsafe { the_host().borrow().cdr(raw) }
}

#[no_mangle]
pub fn h_gc_color(raw: Raw) -> Raw {
    unsafe { the_host().borrow().gc_color(raw) }
}

#[no_mangle]
pub fn h_gc_state() -> Raw {
    unsafe { the_host().borrow().gc_state() }
}
