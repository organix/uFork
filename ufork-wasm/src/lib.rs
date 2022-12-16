mod utils;

use wasm_bindgen::prelude::*;
use std::fmt;

pub mod ufork;
//pub mod cons;  // FIXME: remove this experimental module!

use crate::ufork::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// FIXME: `use js_sys;` instead?
extern crate js_sys;
extern crate web_sys;

#[wasm_bindgen]
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
#[wasm_bindgen]
impl Host {
    pub fn new() -> Host {
        utils::set_panic_hook();  // log panic messages to browser console
        let core = Core::new();
        Host {
            core,
        }
    }
    pub fn prepare(&mut self) {  // prepare for next instruction
        self.core.check_for_interrupt();
        self.core.dispatch_event();
    }
    pub fn step(&mut self) -> bool {  // single-step instruction execution
        let ok = self.core.execute_instruction();
        if ok {
            self.prepare();
        }
        ok
    }

    pub fn rom_addr(&self, ofs: Raw) -> Raw { Any::rom(ofs as usize).raw() }
    pub fn ram_addr(&self, ofs: Raw) -> Raw { Any::ram(ofs as usize).raw() }
    pub fn mem_top(&self) -> Raw { self.core.ram(MEMORY).t().raw() }
    pub fn mem_next(&self) -> Raw { self.core.ram(MEMORY).x().raw() }
    pub fn mem_free(&self) -> Raw { self.core.ram(MEMORY).y().raw() }
    pub fn mem_root(&self) -> Raw { self.core.ram(MEMORY).z().raw() }
    pub fn equeue(&self) -> Raw { self.core.ram(DDEQUE).t().raw() }
    pub fn kqueue(&self) -> Raw { self.core.ram(DDEQUE).y().raw() }
    pub fn ip(&self) -> Raw { self.core.ip().raw() }
    pub fn sp(&self) -> Raw { self.core.sp().raw() }
    pub fn ep(&self) -> Raw { self.core.ep().raw() }
    pub fn e_self(&self) -> Raw { self.core.self_ptr().raw() }
    pub fn e_msg(&self) -> Raw {
        let ep = self.core.ep();
        let event = self.core.ram(ep);
        event.y().raw()
    }
    pub fn in_mem(&self, v: Raw) -> bool {  // excludes built-in constants and types
        let a = Any::new(v);
        a.is_ptr() && (a.raw() > FREE_T.raw())
    }
    pub fn is_dict(&self, v: Raw) -> bool {
        self.core.typeq(DICT_T, Any::new(v))
    }
    pub fn is_pair(&self, v: Raw) -> bool {
        self.core.typeq(PAIR_T, Any::new(v))
    }
    pub fn car(&self, p: Raw) -> Raw {
        if self.is_pair(p) {
            self.core.car(Any::new(p)).raw()
        } else {
            UNDEF.raw()
        }
    }
    pub fn cdr(&self, p: Raw) -> Raw {
        if self.is_pair(p) {
            self.core.cdr(Any::new(p)).raw()
        } else {
            UNDEF.raw()
        }
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
            s.push_str(" → ");
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
}
