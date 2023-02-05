// uFork device interfaces

use crate::ufork::*;
use crate::greet;
use crate::raw_clock;

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

pub struct ClockDevice {
    // Clock device has no device-specific data
}
impl ClockDevice {
    pub fn new() -> ClockDevice {
        ClockDevice {}
    }
}
impl Device for ClockDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        let cust = event.y();
        let now = raw_clock();
        let msg = Any::fix(now as isize);
        let ep = core.new_event(cust, msg)?;
        core.event_inject(ep);
        Ok(true)  // event handled.
    }
}

pub struct IoDevice {
    // I/O device has no device-specific data
    call_count: usize,
}
impl IoDevice {
    pub fn new() -> IoDevice {
        IoDevice {
            call_count: 0,
        }
    }
}
impl Device for IoDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        let myself = event.x();
        let message = event.y();
        let count = self.call_count + 1;
        //greet("IO");
        let greeting = format!("IO: count={} self={} message={}", count, myself, message);
        greet(greeting.as_str());
        self.call_count = count;
        Ok(true)  // event handled.
    }
}
