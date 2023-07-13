#![no_std]
//#![feature(default_alloc_error_handler)]
//#![feature(alloc_error_handler)]

extern crate alloc;

use ::core::cell::RefCell;

pub mod any;
pub mod core;
pub mod device;
pub mod host;
pub mod quad;

use crate::any::*;
use crate::core::*;
use crate::host::*;
use crate::quad::*;

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &::core::panic::PanicInfo) -> ! {
    ::core::arch::wasm32::unreachable()
}

#[cfg(target_arch = "wasm32")]
#[global_allocator]
//static ALLOCATOR: lol_alloc::LeakingPageAllocator = lol_alloc::LeakingPageAllocator;
static ALLOCATOR: lol_alloc::AssumeSingleThreaded<lol_alloc::FreeListAllocator> = unsafe {
    lol_alloc::AssumeSingleThreaded::new(lol_alloc::FreeListAllocator::new())
};

/*
#[cfg(target_arch = "wasm32")]
#[alloc_error_handler]
fn out_of_memory(_: ::core::alloc::Layout) -> ! {
    ::core::arch::wasm32::unreachable()
}
*/

pub type Error = i32;
pub const E_OK: Error       = 0;    // not an error
pub const E_FAIL: Error     = -1;   // general failure
pub const E_BOUNDS: Error   = -2;   // out of bounds
pub const E_NO_MEM: Error   = -3;   // no memory available
pub const E_NOT_FIX: Error  = -4;   // fixnum required
pub const E_NOT_CAP: Error  = -5;   // capability required
pub const E_NOT_PTR: Error  = -6;   // memory pointer required
pub const E_NOT_ROM: Error  = -7;   // ROM pointer required
pub const E_NOT_RAM: Error  = -8;   // RAM pointer required
pub const E_MEM_LIM: Error  = -9;   // Sponsor memory limit reached
pub const E_CPU_LIM: Error  = -10;  // Sponsor instruction limit reached
pub const E_MSG_LIM: Error  = -11;  // Sponsor event limit reached
pub const E_ASSERT: Error   = -12;  // assertion failed
pub const E_STOP: Error     = -13;  // actor stopped

pub type Raw = u32;  // univeral value type
pub type Num = i32;  // fixnum integer type

// type-tag bits
const MSK_RAW: Raw          = 0xF000_0000;  // mask for type-tag bits
const DIR_RAW: Raw          = 0x8000_0000;  // 1=direct (fixnum), 0=indirect (pointer)
const OPQ_RAW: Raw          = 0x4000_0000;  // 1=opaque (capability), 0=transparent (navigable)
const MUT_RAW: Raw          = 0x2000_0000;  // 1=read-write (mutable), 0=read-only (immutable)

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "capabilities")]
extern {
    pub fn host_clock() -> Raw;
    pub fn host_print(base: *const u8, ofs: usize);
    pub fn host_log(x: Raw);
    pub fn host_timer(delay: Raw, stub: Raw);
    pub fn host_write(code: isize);
    pub fn host_read(stub: Raw) -> bool;
    pub fn host_awp(event_stub: Raw) -> Error;
    pub fn host_trace(event: Raw);
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
    let _ = ep;  // place a breakpoint on this assignment
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
pub fn h_run_loop(limit: i32) -> Raw {
    unsafe {
        the_host().borrow_mut().run_loop(limit)
    }
}

#[no_mangle]
pub fn h_event_inject(sponsor: Raw, target: Raw, msg: Raw) {
    unsafe {
        the_host().borrow_mut().event_inject(sponsor, target, msg)
    }
}

#[no_mangle]
pub fn h_revert() -> bool {
    unsafe {
        the_host().borrow_mut().actor_revert()
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
pub fn h_set_rom_top(top: Raw) {
    unsafe {
        the_host().borrow_mut().set_rom_top(top)
    }
}

#[no_mangle]
pub fn h_reserve_rom() -> Raw {
    unsafe {
        the_host().borrow_mut().reserve_rom()
    }
}

#[no_mangle]
pub fn h_ram_buffer() -> *const Quad {
    unsafe {
        the_host().borrow().ram_buffer()
    }
}

#[no_mangle]
pub fn h_ram_top() -> Raw {
    unsafe {
        the_host().borrow().ram_top()
    }
}

#[no_mangle]
pub fn h_reserve() -> Raw {
    unsafe {
        the_host().borrow_mut().reserve()
    }
}

#[no_mangle]
pub fn h_reserve_stub(device: Raw, target: Raw) -> Raw {
    unsafe {
        the_host().borrow_mut().reserve_stub(device, target)
    }
}

#[no_mangle]
pub fn h_release_stub(ptr: Raw) {
    unsafe {
        the_host().borrow_mut().release_stub(ptr)
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
pub fn h_gc_color(raw: Raw) -> Raw {
    unsafe {
        the_host().borrow().gc_color(raw)
    }
}

#[no_mangle]
pub fn h_gc_state() -> Raw {
    unsafe {
        the_host().borrow().gc_state()
    }
}
