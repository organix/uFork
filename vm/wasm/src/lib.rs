#![cfg_attr(feature = "no_std", no_std)]

extern crate alloc;

use ::core::cell::RefCell;

pub mod host;
pub mod debug_dev;
pub mod clock_dev;
pub mod timer_dev;
pub mod io_dev;
pub mod random_dev;
pub mod host_dev;

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

/* per Kevin Reid */
/*
struct GlobalHost(RefCell<Host>);
unsafe impl Sync for GlobalHost {}
fn the_host() -> &'static RefCell<Host> {
     static THE_HOST: GlobalHost = GlobalHost(RefCell::new(Host::new()));
    &THE_HOST.0
}
*/
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
pub fn h_init() {
    // prepare the core for runtime use before any other entry-point is called
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    core.init()
}

#[no_mangle]
pub fn h_run_loop(limit: i32) -> Raw {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    core.run_loop(limit).raw()
}

#[no_mangle]
pub fn h_event_enqueue(evt: Raw) {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    let ep = Any::new(evt);
    core.event_enqueue(ep)
}

#[no_mangle]
pub fn h_revert() -> bool {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    core.actor_revert()
}

#[no_mangle]
pub fn h_gc_run() {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    core.gc_collect()
}

#[no_mangle]
pub fn h_rom_top() -> Raw {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.rom_top().raw()
}

#[no_mangle]
pub fn h_set_rom_top(top: Raw) {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    let ptr = Any::new(top);
    core.set_rom_top(ptr);
}

#[no_mangle]
pub fn h_reserve_rom() -> Raw {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    core.reserve_rom().unwrap().raw()
}

#[no_mangle]
pub fn h_ram_top() -> Raw {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.ram_top().raw()
}

#[no_mangle]
pub fn h_reserve() -> Raw {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    core.reserve(&Quad::empty_t()).unwrap().raw()
}

#[no_mangle]
pub fn h_reserve_stub(device: Raw, target: Raw) -> Raw {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    let device_ptr = Any::new(device);
    let target_ptr = Any::new(target);
    core.reserve_stub(device_ptr, target_ptr).unwrap().raw()
}

#[no_mangle]
pub fn h_release_stub(ptr: Raw) {
    let mut host = unsafe { the_host().borrow_mut() };
    let core = host.mut_core();
    core.release_stub(Any::new(ptr))
}

#[no_mangle]
pub fn h_car(raw: Raw) -> Raw {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.car(Any::new(raw)).raw()
}

#[no_mangle]
pub fn h_cdr(raw: Raw) -> Raw {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.cdr(Any::new(raw)).raw()
}

#[no_mangle]
pub fn h_gc_color(raw: Raw) -> Raw {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.gc_color(Any::new(raw)).raw()
}

#[no_mangle]
pub fn h_gc_state() -> Raw {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.gc_state().raw()
}

/*
*  WARNING! The methods below give _unsafe_ access
*  to the underlying buffers. They are intended
*  to provide access (read/write) to WASM Host.
*/

#[no_mangle]
pub fn h_rom_buffer() -> *const Quad {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.rom_buffer().as_ptr()
}

#[no_mangle]
pub fn h_ram_buffer() -> *const Quad {
    let host = unsafe { the_host().borrow() };
    let core = host.the_core();
    core.ram_buffer().as_ptr()
}
