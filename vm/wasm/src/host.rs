// WASM host interface adapter for ufork::core::Core

use alloc::boxed::Box;

use crate::*;

use ufork::core::*;

#[link(wasm_import_module = "capabilities")]
extern "C" {
    pub fn host_trace(event: Raw);
}

pub struct Host {
    core: Core,
}

impl Host {
    pub fn new() -> Host {
        let mut core = Core::new();
        core.init();
        core.install_device(DEBUG_DEV, Box::new(debug_dev::DebugDevice::new()));
        core.install_device(CLOCK_DEV, Box::new(clock_dev::ClockDevice::new()));
        core.install_device(IO_DEV, Box::new(io_dev::IoDevice::new()));
        core.install_device(BLOB_DEV, Box::new(ufork::blob_dev::BlobDevice::new()));
        core.install_device(TIMER_DEV, Box::new(timer_dev::TimerDevice::new()));
        core.install_device(RANDOM_DEV, Box::new(random_dev::RandomDevice::new()));
        core.install_device(HOST_DEV, Box::new(host_dev::HostDevice::new()));
        core.set_trace_event(|ep, _kp| {
            unsafe {
                host_trace(ep.raw());
            }
        });
        Host { core }
    }

    pub fn the_core(&self) -> &Core {
        &self.core
    }
    pub fn mut_core(&mut self) -> &mut Core {
        &mut self.core
    }

}
