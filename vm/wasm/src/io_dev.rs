// The IoDevice is described in `io_dev.md`.

use ufork::*;
use ufork::any::*;
use ufork::quad::*;
use ufork::core::Core;

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host_write(code: Raw) -> Raw;
    pub fn host_read(stub: Raw) -> Raw;
}

pub struct IoDevice {}
impl IoDevice {
    pub const fn new() -> IoDevice {
        IoDevice {}
    }
}
impl Device for IoDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let dev = event.x();
        let msg = event.y();  // (to_cancel callback . #?) | (to_cancel callback . fixnum)
        if core.typeq(PAIR_T, msg) {
            let _to_cancel = core.nth(msg, PLUS_1);
            // FIXME: cancel option not implemented
            let callback = core.nth(msg, PLUS_2);
            if !callback.is_cap() {
                return Err(E_NOT_CAP);
            }
            let data = core.nth(msg, MINUS_2);
            if data == UNDEF {  // (to_cancel callback . #?)
                // read request
                let evt = core.reserve_event(sponsor, callback, UNDEF)?;
                let stub = core.reserve_stub(dev, evt)?;
                let raw = unsafe {
                    host_read(stub.raw())
                };
                let char = Any::new(raw);
                if char.is_fix() {
                    // if `read` was synchronous, reply immediately
                    let result = core.reserve(&Quad::pair_t(TRUE, char))?;  // (#t . char)
                    core.ram_mut(evt).set_y(result);  // msg = result
                    core.event_enqueue(evt);
                    core.release_stub(stub);
                }
            } else if data.is_fix() {  // (to_cancel callback . fixnum)
                // write request
                unsafe {
                    host_write(data.raw());  // FIXME: what does `host_write` return?
                }
                // in the current implementation, `write` is synchronous, so we reply immediately
                let result = core.reserve(&Quad::pair_t(TRUE, UNDEF))?;  // (#t . #?)
                let evt = core.reserve_event(sponsor, callback, result)?;
                core.event_enqueue(evt);
            }
        }
        // NOTE: unrecognized messages may be ignored
        Ok(())  // event handled.
    }
}
