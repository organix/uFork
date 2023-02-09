// uFork device interfaces

use crate::ufork::*;
use crate::greet;

#[cfg(target_arch = "wasm32")]
use crate::raw_clock;

pub trait Device {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error>;
}

pub struct NullDevice {}
impl NullDevice {
    pub fn new() -> NullDevice {
        NullDevice {}
    }
}
impl Device for NullDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        println!("NullDevice::handle_event: event={} -> {}", ep, event);
        Ok(true)  // event handled.
        //Err(String::from("NullDevice::failure!"))  // force failure...
    }
}

pub struct ClockDevice {
    clock_ticks: Any,
}
impl ClockDevice {
    pub fn new() -> ClockDevice {
        ClockDevice {
            clock_ticks: ZERO,
        }
    }
    #[cfg(target_arch = "wasm32")]
    fn read_clock(&mut self) -> Any {
        let raw = raw_clock();
        let now = Any::fix(raw as isize);
        self.clock_ticks = now;
        now
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn read_clock(&mut self) -> Any {
        match self.clock_ticks.fix_num() {
            Some(t) => {
                let now = Any::fix(t + 13);  // arbitrary advance on each call
                self.clock_ticks = now;
                now
            }
            None => ZERO,
        }
    }
}
impl Device for ClockDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        println!("ClockDevice::handle_event: event={} -> {}", ep, event);
        let sponsor = event.t();
        let cust = event.y();
        let now = self.read_clock();
        println!("ClockDevice::handle_event: now={}", now);
        core.event_inject(sponsor, cust, now)?;
        Ok(true)  // event handled.
    }
}

pub struct IoDevice {
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
        let count = self.call_count + 1;
        println!("IoDevice::handle_event: event({})={} -> {}", count, ep, event);
        let myself = event.x();
        let message = event.y();
        let greeting = format!("IO: count={} self={} message={}", count, myself, message);
        greet(greeting.as_str());
        self.call_count = count;
        Ok(true)  // event handled.
    }
}
