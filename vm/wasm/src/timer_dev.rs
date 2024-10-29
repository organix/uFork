// The TimerDevice is described in `timer_dev.md`.

use ufork::*;
use ufork::any::*;
use ufork::quad::*;
use ufork::core::Core;

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host_start_timer(delay: Raw, stub: Raw);
    pub fn host_stop_timer(stub: Raw) -> bool;
}

pub struct TimerDevice {}
impl TimerDevice {
    pub const fn new() -> TimerDevice {
        TimerDevice {}
    }
}
impl Device for TimerDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let dev = event.x();
        let msg = event.y();
        let ptr = core.cap_to_ptr(dev);
        let myself = core.ram(ptr);
        if myself.t() == PROXY_T {
            // stop timer request
            let handle = myself.y();
            if handle.is_ram() {
                let ok = unsafe {
                    host_stop_timer(handle.raw())
                };
                if ok {
                    core.release_stub(handle);
                }
                core.ram_mut(ptr).set_y(UNDEF);
            }
        } else {
            // start timer request
            let arg_1 = core.nth(msg, PLUS_1);
            if arg_1.is_fix() {  // simple delayed message
                // (delay target . message)
                let delay = arg_1;
                let target = core.nth(msg, PLUS_2);
                if !target.is_cap() {
                    return Err(E_NOT_CAP);
                }
                let message = core.nth(msg, MINUS_2);
                let delayed = Quad::new_event(sponsor, target, message);
                let ptr = core.reserve(&delayed)?;
                let stub = core.reserve_stub(dev, ptr)?;
                unsafe {
                    host_start_timer(delay.raw(), stub.raw());
                }
            } else {  // requestor-style interface
                // (to_cancel callback delay . result)
                let to_cancel = arg_1;
                let callback = core.nth(msg, PLUS_2);
                if !callback.is_cap() {
                    return Err(E_NOT_CAP);
                }
                let delay = core.nth(msg, PLUS_3);
                if !delay.is_fix() {
                    return Err(E_NOT_FIX);
                }
                let result = core.nth(msg, MINUS_3);
                let delayed = Quad::new_event(sponsor, callback, result);
                let ptr = core.reserve(&delayed)?;
                let stub = core.reserve_stub(dev, ptr)?;
                unsafe {
                    host_start_timer(delay.raw(), stub.raw());
                }
                if to_cancel.is_cap() {
                    let proxy = core.reserve_proxy(dev, stub)?;
                    let evt = core.reserve_event(sponsor, to_cancel, proxy)?;
                    core.event_enqueue(evt);
                }
            }
        }
        Ok(())  // event handled.
    }
}
