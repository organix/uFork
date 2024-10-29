// The HostDevice is described in `host_dev.md`.

use ufork::*;
use ufork::any::*;
use ufork::core::Core;

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host(event_stub_or_proxy: Raw) -> Error;
}

pub struct HostDevice {}
impl HostDevice {
    pub const fn new() -> HostDevice {
        HostDevice {}
    }
}
impl Device for HostDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let device = event.x();
        let event_stub = core.reserve_stub(device, ep)?;
        let raw = unsafe {
            host(event_stub.raw())
        };
        match raw {
            E_OK => Ok(()),
            code => {
                core.release_stub(event_stub);
                Err(code)
            }
        }
    }
    fn drop_proxy(&mut self, _core: &mut Core, proxy: Any) {
        unsafe {
            host(proxy.raw());
        }
    }
}
