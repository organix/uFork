// The DebugDevice sends a message to the "debug console".

use ufork::*;
use ufork::any::*;
use ufork::core::Core;

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host_log(x: Raw);
}

pub struct DebugDevice {}
impl DebugDevice {
    pub const fn new() -> DebugDevice {
        DebugDevice {}
    }
}
impl Device for DebugDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let message = event.y();  // message
        let raw = message.raw();
        unsafe {
            host_log(raw);
        }
        Ok(())  // event handled.
    }
}
