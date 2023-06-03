// JavaScript interface adapter for ufork_wasm::core::Core

use crate::*;

pub struct Host {
    core: Core,
}

impl Host {
    pub fn new() -> Host {
        let core = Core::new();
        Host {
            core,
        }
    }
    pub fn run_loop(&mut self) -> Error {
        self.core.run_loop()
    }
    pub fn step(&mut self) -> Error {  // single-step instruction execution
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

    pub fn event_inject(&mut self, sponsor: Raw, target: Raw, msg: Raw) {
        self.core.event_inject(
            Any::new(sponsor),
            Any::new(target),
            Any::new(msg)
        ).unwrap()
    }
    pub fn actor_revert(&mut self) -> bool {
        self.core.actor_revert()
    }
    pub fn gc_run(&mut self) {
        self.core.gc_collect()
    }
    pub fn rom_top(&self) -> Raw {
        self.core.rom_top().raw()
    }
    pub fn set_rom_top(&mut self, top: Raw) {
        let ptr = Any::new(top);
        assert!(ptr.is_rom());
        self.core.set_rom_top(ptr);
    }
    pub fn reserve_rom(&mut self) -> Raw {
        self.core.reserve_rom().unwrap().raw()
    }
    pub fn ram_top(&self) -> Raw {
        self.core.ram_top().raw()
    }
    pub fn reserve(&mut self) -> Raw {
        self.core.reserve(&Quad::empty_t()).unwrap().raw()
    }
    pub fn reserve_stub(&mut self, device: Raw, target: Raw) -> Raw {
        let device_ptr = Any::new(device);
        assert!(device_ptr.is_cap());
        let target_ptr = Any::new(target);
        self.core.reserve_stub(device_ptr, target_ptr).unwrap().raw()
    }
    pub fn release_stub(&mut self, ptr: Raw) {
        self.core.release_stub(Any::new(ptr))
    }
    pub fn blob_top(&self) -> Raw {
        self.core.blob_top().raw()
    }
    pub fn car(&self, p: Raw) -> Raw {
        self.core.car(Any::new(p)).raw()
    }
    pub fn cdr(&self, p: Raw) -> Raw {
        self.core.cdr(Any::new(p)).raw()
    }
    pub fn gc_color(&self, p: Raw) -> Raw {
        self.core.gc_color(Any::new(p)).raw()
    }
    pub fn gc_state(&self) -> Raw {
        self.core.gc_state().raw()
    }

    /*
     *  WARNING! The methods below give _unsafe_ access
     *  to the underlying buffers. They are intended
     *  to provide access (read/write) to WASM Host.
     */
    pub fn rom_buffer(&self) -> *const Quad {
        self.core.rom_buffer().as_ptr()
    }
    pub fn ram_buffer(&self) -> *const Quad {
        self.core.ram_buffer().as_ptr()
    }
    pub fn blob_buffer(&self) -> *const u8 {
        self.core.blob_buffer().as_ptr()
    }
}
