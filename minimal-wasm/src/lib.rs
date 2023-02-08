#![no_std]                                  // no_std only
#![feature(alloc_error_handler)]            // no_std only

pub mod ufork;
pub mod device;
pub mod host;

extern crate alloc;
extern crate lol_alloc;                     // no_std only
use core::arch::wasm32::unreachable;        // no_std only
use core::panic::PanicInfo;                 // no_std only
use alloc::alloc::Layout;                   // no_std only
use lol_alloc::AssumeSingleThreaded;        // no_std only
use lol_alloc::FreeListAllocator;           // no_std only
use alloc::boxed::Box;
use core::cell::RefCell;
use crate::host::*;
use crate::ufork::*;

// In no_std mode, it is our responsibility to handle memory allocation,
// out-of-memory events, and panics. The simplest failure strategy is to jump to
// WASM's 'unreachable' instruction, causing execution to cease. If a debugger
// is attached, it will display a stack trace of preceeding WASM instructions.

#[global_allocator]
static ALLOCATOR: AssumeSingleThreaded<FreeListAllocator> = unsafe {
    AssumeSingleThreaded::new(FreeListAllocator::new())
};

#[alloc_error_handler]
fn out_of_memory(_: Layout) -> ! {
    unreachable()
}

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unreachable()
}

// The following declaration references a JavaScript function, provided as an
// import.

#[link(wasm_import_module = "imports")]
extern {
    fn double(x: u32) -> u32;
}

// The 'call_double' function is exported, and can be called from JavaScript. It
// returns the result of calling 'double', the imported JavaScript function.
// This gives us synchronous bidirectional communication.

#[no_mangle]
pub fn call_double(x: u32) -> u32 {
    unsafe {
        double(x)
    }
}

// Now that we have the means to allocate memory, panic and communicate with the
// outside world, we can start defining our interface.

// Our interface includes an 'init' function that creates a Host singleton.

// Using a singleton in Rust presents some difficulties. To ensure thread
// safety, the compiler enforces tight restrictions on how shared mutable
// variables may be used used. Sharing mutable variables safely across threads
// requires a deep understanding of Rust's type system, which I don't have. But
// we don't need thread safety, because in a WASM environment we have only a
// single thread.

// This is the simplest solution I could devise. We keep a raw pointer to a
// RefCell containing the Host singleton, and dereference it when needed with
// the 'singleton' function. All of this is considered unsafe.

static mut SINGLETON_POINTER: u32 = 0;

unsafe fn singleton() -> *mut RefCell<Host> {
    SINGLETON_POINTER as *mut RefCell<Host>
}

// The 'init' function creates the singleton. It must be called exactly once,
// before any of the methods are called.

#[no_mangle]
pub unsafe fn init() {
    let instance = Host::new();
    SINGLETON_POINTER = Box::into_raw(Box::new(RefCell::new(instance))) as u32;
}

// Now we need some proxy functions, one for each method of the Host singleton.

// It would be a chore to write out every single method by hand, so we use a
// macro to generate them. Each generated function calls the Host's
// method of the same name, propagating the arguments and return value (if any).

macro_rules! method {
    ($name:tt, $return_type:ty, $($arg_name:tt: $arg_type:ty),+) => {
        #[no_mangle]
        pub unsafe fn $name($($arg_name: $arg_type),*) -> $return_type {
            (&*singleton()).borrow_mut().$name($($arg_name),*)
        }
    };
    ($name:tt, $return_type:ty) => {
        #[no_mangle]
        pub unsafe fn $name() -> $return_type {
            (&*singleton()).borrow_mut().$name()
        }
    };
    ($name:tt) => {
        #[no_mangle]
        pub unsafe fn $name() {
            (&*singleton()).borrow_mut().$name()
        }
    };
}

method!(step, bool);
method!(fixnum, Raw, num: Num);
method!(rom_addr, Raw, ofs: Raw);
method!(ram_addr, Raw, bank: Raw, ofs: Raw);
method!(gc_phase, Raw);
method!(gc_run);
method!(sponsor_memory, Raw);
method!(sponsor_events, Raw);
method!(sponsor_instrs, Raw);
method!(mem_top, Raw);
method!(mem_next, Raw);
method!(mem_free, Raw);
method!(mem_root, Raw);
method!(equeue, Raw);
method!(kqueue, Raw);
method!(ip, Raw);
method!(sp, Raw);
method!(ep, Raw);
method!(e_self, Raw);
method!(e_msg, Raw);
method!(in_mem, bool, v: Raw);
method!(is_dict, bool, v: Raw);
method!(is_pair, bool, v: Raw);
method!(car, Raw, p: Raw);
method!(cdr, Raw, p: Raw);
method!(next, Raw, p: Raw);
