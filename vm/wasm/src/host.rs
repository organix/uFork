// WASM host interface adapter for ufork::core::Core

use alloc::boxed::Box;

use crate::*;

use ufork::{any::*, core::*, device::*};

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
        core.install_device(IO_DEV, Box::new(IoDevice {
            write: |code| unsafe {
                let raw = crate::host_write(code.raw());
                Any::new(raw)
            },
            read: |stub| unsafe {
                let raw = crate::host_read(stub.raw());
                Any::new(raw)
            }
        }));
        core.install_device(BLOB_DEV, Box::new(ufork::blob_dev::BlobDevice::new()));
        core.install_device(TIMER_DEV, Box::new(TimerDevice {
            start_timer: |delay, stub| unsafe {
                crate::host_start_timer(delay.raw(), stub.raw());
            },
            stop_timer: |stub| unsafe {
                crate::host_stop_timer(stub.raw())
            },
        }));
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
