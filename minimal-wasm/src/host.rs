//std use core::fmt;

use crate::ufork::*;

pub struct Host {
    core: Core,
}

//std impl fmt::Display for Host {
//std     fn fmt(&self, fmt: &mut fmt::Formatter) -> fmt::Result {
//std         //let core = &self.core;
//std         for raw in 0..512 {
//std             /*
//std             let typed = core.typed(Ptr::new(raw));
//std             write!(fmt, "{:5}: {}\n", raw, typed)?;
//std             */
//std             //write!(fmt, "{}\n", self.display(raw))?;
//std             write!(fmt, "{:5}: {}\n", raw, self.display(raw))?;
//std         }
//std         /*
//std         write!(fmt, "\n")?;
//std         write!(fmt, "IP:{} -> {}\n", core.ip(), core.typed(core.ip()))?;
//std         write!(fmt, "SP:{} -> {}\n", core.sp(), core.typed(core.sp()))?;
//std         write!(fmt, "EP:{} -> {}\n", core.ep(), core.typed(core.ep()))?;
//std         */
//std         Ok(())
//std     }
//std }

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
                if !more {
                    //std println!("continuation queue empty!");
                    return false;  // no more instructions...
                }
            },
            //std Err(error) => {
            Err(_) => {
                //std println!("execution ERROR! {}", error);
                return false;  // execute instruction failed...
            },
        }
        //std if let Err(error) = self.core.check_for_interrupt() {
        if let Err(_) = self.core.check_for_interrupt() {
            //std println!("interrupt ERROR! {}", error);
            return false;  // interrupt handler failed...
        }
        //std if let Err(error) = self.core.dispatch_event() {
        if let Err(_) = self.core.dispatch_event() {
            //std println!("dispatch ERROR! {}", error);
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
    pub fn mem_top(&self) -> Raw { self.core.mem_top().raw() }
    pub fn mem_next(&self) -> Raw { self.core.mem_next().raw() }
    pub fn mem_free(&self) -> Raw { self.core.mem_free().raw() }
    pub fn mem_root(&self) -> Raw { self.core.mem_root().raw() }
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

//std     pub fn pprint(&self, raw: Raw) -> String {
//std         if self.is_pair(raw) {
//std             let mut s = String::new();
//std             let mut p = raw;
//std             let mut sep = "(";
//std             while self.is_pair(p) {
//std                 s.push_str(sep);
//std                 let ss = self.pprint(self.car(p));
//std                 s.push_str(ss.as_str());
//std                 sep = " ";
//std                 p = self.cdr(p);
//std             }
//std             if NIL.raw() != p {
//std                 s.push_str(" . ");
//std                 let ss = self.pprint(p);
//std                 s.push_str(ss.as_str());
//std             }
//std             s.push_str(")");
//std             s
//std         } else if self.is_dict(raw) {
//std             let mut s = String::new();
//std             let mut p = raw;
//std             let mut sep = "{";
//std             while self.is_dict(p) {
//std                 let entry = self.core.mem(Any::new(p));
//std                 let key = entry.x();
//std                 let value = entry.y();
//std                 let next = entry.z();
//std                 s.push_str(sep);
//std                 /*
//std                 s.push_str(self.disasm(p).as_str());
//std                 */
//std                 s.push_str(self.print(key.raw()).as_str());
//std                 s.push_str(":");
//std                 s.push_str(self.pprint(value.raw()).as_str());
//std                 sep = ", ";
//std                 p = next.raw();
//std             }
//std             s.push_str("}");
//std             s
//std         } else {
//std             self.print(raw)
//std         }
//std     }
//std     pub fn display(&self, raw: Raw) -> String {
//std         let mut s = String::new();
//std         let ss = self.print(raw);
//std         s.push_str(ss.as_str());
//std         let val = Any::new(raw);
//std         if val.is_ptr() {
//std             if raw < self.mem_top() {
//std                 s.push_str(" → ");
//std             } else {
//std                 s.push_str(" × ");
//std             }
//std             let ss = self.disasm(raw);
//std             s.push_str(ss.as_str());
//std         }
//std         s
//std     }
//std     pub fn disasm(&self, raw: Raw) -> String {
//std         let val = Any::new(raw);
//std         if val.is_ptr() {
//std             let quad = self.core.mem(val);
//std             /*
//std             if let Some(typed) = Typed::from(quad) {
//std                 typed.to_string()
//std             } else {
//std                 quad.to_string()
//std             }
//std             */
//std             quad.to_string()
//std         } else {
//std             self.print(raw)
//std         }
//std     }
//std     pub fn print(&self, raw: Raw) -> String {
//std         Any::new(raw).to_string()
//std     }
//std     pub fn render(&self) -> String {
//std         self.to_string()
//std     }

}

