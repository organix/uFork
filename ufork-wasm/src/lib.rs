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
use std::fmt;
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
pub fn h_rom_top() -> Raw {
    unsafe {
        the_host().borrow().rom_top()
    }
}

#[wasm_bindgen]
pub fn h_ram_top() -> Raw {
    unsafe {
        the_host().borrow().ram_top()
    }
}

#[wasm_bindgen]
pub fn h_ram_next() -> Raw {
    unsafe {
        the_host().borrow().ram_next()
    }
}

#[wasm_bindgen]
pub fn h_ram_free() -> Raw {
    unsafe {
        the_host().borrow().ram_free()
    }
}

#[wasm_bindgen]
pub fn h_ram_root() -> Raw {
    unsafe {
        the_host().borrow().ram_root()
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

#[wasm_bindgen]
pub fn h_rom_buffer() -> *const Quad {
    unsafe {
        the_host().borrow().rom_buffer()
    }
}

#[wasm_bindgen]
pub fn h_ram_buffer(bank: Raw) -> *const Quad {
    unsafe {
        the_host().borrow().ram_buffer(bank)
    }
}

//#[wasm_bindgen]
pub struct Host {
    core: Core,
}

impl fmt::Display for Host {
    fn fmt(&self, fmt: &mut fmt::Formatter) -> fmt::Result {
        //let core = &self.core;
        for raw in 0..512 {
            /*
            let typed = core.typed(Ptr::new(raw));
            write!(fmt, "{:5}: {}\n", raw, typed)?;
            */
            //write!(fmt, "{}\n", self.display(raw))?;
            write!(fmt, "{:5}: {}\n", raw, self.display(raw))?;
        }
        /*
        write!(fmt, "\n")?;
        write!(fmt, "IP:{} -> {}\n", core.ip(), core.typed(core.ip()))?;
        write!(fmt, "SP:{} -> {}\n", core.sp(), core.typed(core.sp()))?;
        write!(fmt, "EP:{} -> {}\n", core.ep(), core.typed(core.ep()))?;
        */
        Ok(())
    }
}

/// Public methods, exported to JavaScript.
//#[wasm_bindgen]
impl Host {
    pub fn new() -> Host {
        let core = Core::new();
        Host {
            core,
        }
    }
    pub fn step(&mut self) -> bool {  // single-step instruction execution
        match self.core.execute_instruction() {
            Ok(more) => {
                if !more && !self.core.e_first().is_ram() {  // EQ must also be empty.
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

    pub fn fixnum(&self, num: Num) -> Raw { Any::fix(num as isize).raw() }
    pub fn rom_addr(&self, ofs: Raw) -> Raw { Any::rom(ofs as usize).raw() }
    pub fn ram_addr(&self, bank: Raw, ofs: Raw) -> Raw { Any::ram(bank, ofs as usize).raw() }
    pub fn gc_phase(&self) -> Raw { self.core.gc_phase() }
    pub fn gc_run(&mut self) { self.core.gc_stop_the_world() }
    pub fn sponsor_memory(&self) -> Raw {
        let ep = self.core.ep();
        let sponsor = self.core.event_sponsor(ep);
        self.core.sponsor_memory(sponsor).raw()
    }
    pub fn sponsor_events(&self) -> Raw {
        let ep = self.core.ep();
        let sponsor = self.core.event_sponsor(ep);
        self.core.sponsor_events(sponsor).raw()
    }
    pub fn sponsor_instrs(&self) -> Raw {
        let ep = self.core.ep();
        let sponsor = self.core.event_sponsor(ep);
        self.core.sponsor_instrs(sponsor).raw()
    }
    pub fn rom_top(&self) -> Raw { self.core.rom_top().raw() }
    pub fn ram_top(&self) -> Raw { self.core.ram_top().raw() }
    pub fn ram_next(&self) -> Raw { self.core.ram_next().raw() }
    pub fn ram_free(&self) -> Raw { self.core.ram_free().raw() }
    pub fn ram_root(&self) -> Raw { self.core.ram_root().raw() }
    pub fn equeue(&self) -> Raw { self.core.e_first().raw() }
    pub fn kqueue(&self) -> Raw { self.core.k_first().raw() }
    pub fn ip(&self) -> Raw { self.core.ip().raw() }
    pub fn sp(&self) -> Raw { self.core.sp().raw() }
    pub fn ep(&self) -> Raw { self.core.ep().raw() }
    pub fn e_self(&self) -> Raw { self.core.self_ptr().raw() }
    pub fn e_msg(&self) -> Raw {
        let ep = self.core.ep();
        if !ep.is_ram() { return UNDEF.raw() }
        let event = self.core.ram(ep);
        event.y().raw()
    }
    pub fn in_mem(&self, v: Raw) -> bool {  // excludes built-in constants and types
        (v > FREE_T.raw()) && !Any::new(v).is_fix()
    }
    pub fn is_dict(&self, v: Raw) -> bool {
        self.core.typeq(DICT_T, Any::new(v))
    }
    pub fn is_pair(&self, v: Raw) -> bool {
        self.core.typeq(PAIR_T, Any::new(v))
    }
    pub fn car(&self, p: Raw) -> Raw {
        self.core.car(Any::new(p)).raw()
    }
    pub fn cdr(&self, p: Raw) -> Raw {
        self.core.cdr(Any::new(p)).raw()
    }
    pub fn next(&self, p: Raw) -> Raw {
        self.core.next(Any::new(p)).raw()
    }

    pub fn pprint(&self, raw: Raw) -> String {
        if self.is_pair(raw) {
            let mut s = String::new();
            let mut p = raw;
            let mut sep = "(";
            while self.is_pair(p) {
                s.push_str(sep);
                let ss = self.pprint(self.car(p));
                s.push_str(ss.as_str());
                sep = " ";
                p = self.cdr(p);
            }
            if NIL.raw() != p {
                s.push_str(" . ");
                let ss = self.pprint(p);
                s.push_str(ss.as_str());
            }
            s.push_str(")");
            s
        } else if self.is_dict(raw) {
            let mut s = String::new();
            let mut p = raw;
            let mut sep = "{";
            while self.is_dict(p) {
                let entry = self.core.mem(Any::new(p));
                let key = entry.x();
                let value = entry.y();
                let next = entry.z();
                s.push_str(sep);
                /*
                s.push_str(self.disasm(p).as_str());
                */
                s.push_str(self.print(key.raw()).as_str());
                s.push_str(":");
                s.push_str(self.pprint(value.raw()).as_str());
                sep = ", ";
                p = next.raw();
            }
            s.push_str("}");
            s
        } else {
            self.print(raw)
        }
    }
    pub fn display(&self, raw: Raw) -> String {
        let mut s = String::new();
        let ss = self.print(raw);
        s.push_str(ss.as_str());
        let val = Any::new(raw);
        if val.is_ptr() {
            if raw < self.ram_top() {
                s.push_str(" → ");
            } else {
                s.push_str(" × ");
            }
            let ss = self.disasm(raw);
            s.push_str(ss.as_str());
        }
        s
    }
    pub fn disasm(&self, raw: Raw) -> String {
        let val = Any::new(raw);
        if val.is_ptr() {
            let quad = self.core.mem(val);
            /*
            if let Some(typed) = Typed::from(quad) {
                typed.to_string()
            } else {
                quad.to_string()
            }
            */
            quad.to_string()
        } else {
            self.print(raw)
        }
    }
    pub fn print(&self, raw: Raw) -> String {
        Any::new(raw).to_string()
    }

    pub fn render(&self) -> String {
        self.to_string()
    }

    /*
     *  WARNING! The methods below give _unsafe_ access
     *  to the underlying buffers. They are intended
     *  to provide access (read/write) to JavaScript.
     */
    pub fn rom_buffer(&self) -> *const Quad {
        self.core.rom_buffer().as_ptr()
    }
    pub fn ram_buffer(&self, bank: Raw) -> *const Quad {
        self.core.ram_buffer(bank).as_ptr()
    }
}
