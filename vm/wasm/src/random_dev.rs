// The RandomDevice is described in `random_dev.md`.

use ufork::*;
use ufork::any::*;
use ufork::core::Core;

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host_random(a: Raw, b: Raw) -> Raw;
}

pub struct RandomDevice {}
impl RandomDevice {
    pub const fn new() -> RandomDevice {
        RandomDevice {}
    }
}
impl Device for RandomDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let msg = event.y();  // cust | (cust . limit) | (cust a . b)
        let cust = if msg.is_cap() {
            msg
        } else {
            core.nth(msg, PLUS_1)
        };
        let limit = core.nth(msg, MINUS_1);
        let a = core.nth(msg, PLUS_2);
        let b = core.nth(msg, MINUS_2);
        let raw = unsafe {
            if msg.is_cap() {
                host_random(UNDEF.raw(), UNDEF.raw())
            } else if limit.is_fix() {
                host_random(limit.raw(), UNDEF.raw())
            } else {
                host_random(a.raw(), b.raw())
            }
        };
        let random = Any::fix(raw as isize);
        let evt = core.reserve_event(sponsor, cust, random)?;
        core.event_enqueue(evt);
        Ok(())  // event handled.
    }
}
