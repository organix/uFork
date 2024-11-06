#![cfg_attr(feature = "no_std", no_std)]

extern crate alloc;

use alloc::boxed::Box;

use ::core::cell::RefCell;

pub mod debug_dev;
pub mod clock_dev;
pub mod timer_dev;
pub mod io_dev;
pub mod random_dev;
pub mod host_dev;

use ufork::{core::*, any::Any, quad::Quad, Raw};

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
    pub fn host_trace(event: Raw);
}

/* Static Singleton per Kevin Reid */
fn the_core() -> &'static RefCell<Core> {
    struct SingletonCore(RefCell<Core>);
    // SAFETY: intrinsically single-threaded environment, so synchronization is unnecessary.
    unsafe impl Sync for SingletonCore {}
    static THE_CORE: SingletonCore = SingletonCore(RefCell::new(Core::new()));

    &THE_CORE.0
}

#[no_mangle]
pub fn h_init() {
    // prepare the core for runtime use before any other entry-point is called
    let mut core = the_core().borrow_mut();
    core.init();
    core.install_device(DEBUG_DEV, Box::new(debug_dev::DebugDevice::new()));
    core.install_device(CLOCK_DEV, Box::new(clock_dev::ClockDevice::new()));
    core.install_device(TIMER_DEV, Box::new(timer_dev::TimerDevice::new()));
    core.install_device(IO_DEV, Box::new(io_dev::IoDevice::new()));
    core.install_device(BLOB_DEV, Box::new(ufork::blob_dev::BlobDevice::new()));
    core.install_device(RANDOM_DEV, Box::new(random_dev::RandomDevice::new()));
    core.install_device(HOST_DEV, Box::new(host_dev::HostDevice::new()));
    core.set_trace_event(|ep, _kp| {
        unsafe {
            host_trace(ep.raw());
        }
    });
}

#[no_mangle]
pub fn h_run_loop(limit: i32) -> Raw {
    let mut core = the_core().borrow_mut();
    core.run_loop(limit).raw()
}

#[no_mangle]
pub fn h_event_enqueue(evt: Raw) {
    let mut core = the_core().borrow_mut();
    let ep = Any::new(evt);
    core.event_enqueue(ep)
}

#[no_mangle]
pub fn h_revert() -> bool {
    let mut core = the_core().borrow_mut();
    core.actor_revert()
}

#[no_mangle]
pub fn h_gc_run() {
    let mut core = the_core().borrow_mut();
    core.gc_collect_all()
}

#[no_mangle]
pub fn h_rom_top() -> Raw {
    let core = the_core().borrow();
    core.rom_top().raw()
}

#[no_mangle]
pub fn h_set_rom_top(top: Raw) {
    let mut core = the_core().borrow_mut();
    let ptr = Any::new(top);
    core.set_rom_top(ptr);
}

#[no_mangle]
pub fn h_reserve_rom() -> Raw {
    let mut core = the_core().borrow_mut();
    core.reserve_rom().unwrap().raw()
}

#[no_mangle]
pub fn h_ram_top() -> Raw {
    let core = the_core().borrow();
    core.ram_top().raw()
}

#[no_mangle]
pub fn h_reserve() -> Raw {
    let mut core = the_core().borrow_mut();
    core.reserve(&Quad::empty_t()).unwrap().raw()
}

#[no_mangle]
pub fn h_reserve_stub(device: Raw, target: Raw) -> Raw {
    let mut core = the_core().borrow_mut();
    let device_ptr = Any::new(device);
    let target_ptr = Any::new(target);
    core.reserve_stub(device_ptr, target_ptr).unwrap().raw()
}

#[no_mangle]
pub fn h_release_stub(ptr: Raw) {
    let mut core = the_core().borrow_mut();
    core.release_stub(Any::new(ptr))
}

#[no_mangle]
pub fn h_car(raw: Raw) -> Raw {
    let core = the_core().borrow();
    core.car(Any::new(raw)).raw()
}

#[no_mangle]
pub fn h_cdr(raw: Raw) -> Raw {
    let core = the_core().borrow();
    core.cdr(Any::new(raw)).raw()
}

#[no_mangle]
pub fn h_gc_color(raw: Raw) -> Raw {
    let core = the_core().borrow();
    core.gc_color(Any::new(raw)).raw()
}

#[no_mangle]
pub fn h_gc_state() -> Raw {
    let core = the_core().borrow();
    core.gc_state().raw()
}

/*
*  WARNING! The methods below give _unsafe_ access
*  to the underlying buffers. They are intended
*  to provide access (read/write) to WASM Host.
*/

#[no_mangle]
pub fn h_rom_buffer() -> *const Quad {
    let core = the_core().borrow();
    core.rom_buffer().as_ptr()
}

#[no_mangle]
pub fn h_ram_buffer() -> *const Quad {
    let core = the_core().borrow();
    core.ram_buffer().as_ptr()
}
