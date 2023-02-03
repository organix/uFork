// uFork device interfaces

use crate::ufork::*;

pub trait Device {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error>;
}

pub struct NullDevice {
    // Null device has no device-specific data
    call_count: usize,
}
impl NullDevice {
    pub fn new() -> NullDevice {
        NullDevice {
            call_count: 0,
        }
    }
}
impl Device for NullDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        let count = self.call_count + 1;
        println!("NullDevice::handle_event: event({})={} -> {}", count, ep, event);
        self.call_count = count;
        Ok(true)  // event handled.
    }
}
