// The ClockDevice is described in `clock_dev.md`.

use ufork::*;
use ufork::any::*;
use ufork::core::Core;

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host_clock() -> Raw;
}

pub struct ClockDevice {}
impl ClockDevice {
    pub const fn new() -> ClockDevice {
        ClockDevice {}
    }
}
impl Device for ClockDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let cust = event.y();  // cust
        let raw = unsafe {
            host_clock()
        };
        let now = Any::fix(raw as isize);
        let evt = core.reserve_event(sponsor, cust, now)?;
        core.event_enqueue(evt);
        Ok(())  // event handled.
    }
}
