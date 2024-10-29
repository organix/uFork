// WASM host interface adapter for ufork::core::Core

use alloc::boxed::Box;

use crate::*;

use ufork::{any::*, core::Core, device::*};

pub struct Host {
    core: Core,
}

impl Host {
    pub fn new() -> Host {
        let mut core = Core::new([
            Some(Box::new(debug_dev::DebugDevice::new())),
            Some(Box::new(ClockDevice {
                read_clock: || {
                    let raw = unsafe { crate::host_clock() };
                    let now = Any::fix(raw as isize);
                    now
                },
            })),
            Some(Box::new(IoDevice {
                write: |code| unsafe {
                    let raw = crate::host_write(code.raw());
                    Any::new(raw)
                },
                read: |stub| unsafe {
                    let raw = crate::host_read(stub.raw());
                    Any::new(raw)
                }
            })),
            Some(Box::new(ufork::blob_dev::BlobDevice::new())),
            Some(Box::new(TimerDevice {
                start_timer: |delay, stub| unsafe {
                    crate::host_start_timer(delay.raw(), stub.raw());
                },
                stop_timer: |stub| unsafe {
                    crate::host_stop_timer(stub.raw())
                },
            })),
            Some(Box::new(ufork::null_dev::NullDevice::new())),
            Some(Box::new(HostDevice {
                to_host: |event_stub_or_proxy| unsafe {
                    crate::host(event_stub_or_proxy.raw())
                }
            })),
            Some(Box::new(RandomDevice {
                get_random: |a, b| unsafe {
                    let raw = crate::host_random(a.raw(), b.raw());
                    Any::fix(raw as isize)
                },
            })),
            Some(Box::new(ufork::fail_dev::FailDevice::new())),
            Some(Box::new(ufork::fail_dev::FailDevice::new())),
            Some(Box::new(ufork::fail_dev::FailDevice::new())),
            Some(Box::new(ufork::fail_dev::FailDevice::new())),
            Some(Box::new(ufork::fail_dev::FailDevice::new())),
        ]);
        core.init();
        core.set_trace_event(|ep, kp| {
            trace_event(ep, kp);
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
