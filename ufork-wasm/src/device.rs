// uFork device interfaces

use crate::*;

pub trait Device {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error>;
    fn drop_proxy(&mut self, _ptr: Any) {}  // default: no-op
    fn move_stub(&mut self, _old: Any, _new: Any) {}  // default: no-op
}

pub struct NullDevice {}
impl NullDevice {
    pub fn new() -> NullDevice {
        NullDevice {}
    }
}
impl Device for NullDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let _event = core.mem(ep);
        //panic!();  // terminate simulator!
        //Err(E_FAIL)  // force failure...
        Ok(true)  // event handled.
    }
}

pub struct DebugDevice {}
impl DebugDevice {
    pub fn new() -> DebugDevice {
        DebugDevice {}
    }
    #[cfg(target_arch = "wasm32")]
    fn debug_print(&mut self, value: Any) {
        let raw = value.raw();
        unsafe {
            crate::host_log(raw);
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn debug_print(&mut self, value: Any) {
        // debug output not available...
        let _ = value.raw();  // place a breakpoint on this assignment
    }
}
impl Device for DebugDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        let message = event.y();
        self.debug_print(message);
        Ok(true)  // event handled.
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
    /*
    */
    #[cfg(target_arch = "wasm32")]
    fn read_clock(&mut self) -> Any {
        unsafe {
            let raw = crate::host_clock();
            let now = Any::fix(raw as isize);
            self.clock_ticks = now;
            now
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn read_clock(&mut self) -> Any {
        match self.clock_ticks.fix_num() {
            Some(t) => {
                let now = Any::fix(t + 5);  // arbitrary advance on each call
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
        let sponsor = event.t();
        let cust = event.y();
        let now = self.read_clock();
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
        let _myself = event.x();
        let message = event.y();
        let buf = core.blob_buffer();
        let base = buf.as_ptr();
        if !message.is_cap() {
            return Err(E_NOT_CAP);
        }
        let ptr = core.cap_to_ptr(message);
        let proxy = core.ram(ptr);
        if proxy.t() != PROXY_T {
            return Err(E_NOT_PTR);
        }
        if proxy.x() != core.ptr_to_mem(BLOB_DEV) {
            return Err(E_BOUNDS);
        }
        let ofs = proxy.y().get_fix()? as usize;
        greet(base, ofs);
        self.call_count = count;
        Ok(true)  // event handled.
    }
}

fn u16_lsb(nat: usize) -> u8 {
    (nat & 0xFF) as u8
}
fn u16_msb(nat: usize) -> u8 {
    ((nat >> 8) & 0xFF) as u8
}
fn get_u16(core: &Core, ofs: usize) -> usize {
    assert_eq!(0x82, core.blob_read(ofs + 0));  // +Integer
    assert_eq!(16, core.blob_read(ofs + 1));  // size = 16 bits
    let lsb = core.blob_read(ofs + 2) as usize;
    let msb = core.blob_read(ofs + 3) as usize;
    (msb << 8) | lsb
}
fn set_u16(core: &mut Core, ofs: usize, data: usize) {
    core.blob_write(ofs + 0, 0x82);  // +Integer
    core.blob_write(ofs + 1, 16);  // size = 16 bits
    core.blob_write(ofs + 2, u16_lsb(data));
    core.blob_write(ofs + 3, u16_msb(data));
}
/*
let buf = new Uint8Array([              // buffer (9 + 22 = 31 octets)
    0x88,                               // Array
    0x82, 16, 2, 0,                     // length (2 elements)
    0x82, 16, 22, 0,                    // size (13 + 9 = 22 octets)
    0x8B,                               // [0] = Ext (9 + 4 = 13 octets free)
    0x82, 16, 0, 0,                     //       meta (0 offset)
    0x82, 16, 4, 0,                     //       size (4 octets)
    0xDE, 0xAD, 0xBE, 0xEF,             //       data (4 octets)
    0x8A,                               // [1] = Blob (5 + 4 = 9 octets used)
    0x82, 16, 4, 0,                     //       size (4 octets)
    0xCA, 0xFE, 0xBA, 0xBE]);           //       data (4 octets)
*/
fn blob_reserve(core: &mut Core, size: Any) -> Result<Any, Error> {
    let mut need = size.get_fix()? as usize;
    if need < 4 {
        need = 4;  // minimum allocation is 4 octets
    }
    need += 5;  // adjust for Blob header
    let mut ofs: usize = 9;  // start after Array header
    while ofs > 0 {
        assert_eq!(0x8B, core.blob_read(ofs));  // Extension Blob
        ofs += 1;
        let next = get_u16(core, ofs);  // `meta` field is offset of next free Blob (or zero)
        ofs += 4;
        let free = get_u16(core, ofs);  // `size` field is the number of free octets in this Blob
        if need <= free {
            ofs += 4;
            let end = ofs + free;
            let split = free - need;
            set_u16(core, ofs - 4, split);  // adjust `size` field for Blob splitting
            ofs += split;
            core.blob_write(ofs, 0x8A);  // Blob
            ofs += 1;
            set_u16(core, ofs, need - 5);
            ofs += 4;
            let blob = Any::fix(ofs as isize);  // capture offset to user-managed data
            // FIXME: consider clearing memory (to `null`) during de-allocation instead...
            while ofs < end {
                core.blob_write(ofs, 0);  // fill with zero octets
                ofs += 1;
            }
            let count = get_u16(core, 1);  // get number of Array elements
            set_u16(core, 1, count + 1);  // add element for new Blob
            return Ok(blob)
        }
        ofs = next;
    }
    Err(E_NO_MEM)  // BLOB memory exhausted
}
pub struct BlobDevice {}
impl BlobDevice {
    pub fn new() -> BlobDevice {
        BlobDevice {}
    }
}
impl Device for BlobDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let dev = event.x();
        let msg = event.y();
        let cust = core.nth(msg, PLUS_1);
        let size = core.nth(msg, PLUS_2);
        let handle = blob_reserve(core, size)?;
        let proxy = Quad::proxy_t(dev, handle);
        let ptr = core.reserve(&proxy)?;  // no Sponsor needed
        let cap = core.ptr_to_cap(ptr);
        core.event_inject(sponsor, cust, cap)?;
        Ok(true)  // event handled.
    }
}

pub struct TimerDevice {}
impl TimerDevice {
    pub fn new() -> TimerDevice {
        TimerDevice {}
    }
    #[cfg(target_arch = "wasm32")]
    fn set_timer(&mut self, delay: Any, stub: Any) {
        unsafe {
            crate::host_timer(delay.raw(), stub.raw());
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn set_timer(&mut self, _delay: Any, _stub: Any) {
        // timer device not available...
    }
}
impl Device for TimerDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let device = event.x();
        let msg = event.y();
        let delay = core.nth(msg, PLUS_1);
        if !delay.is_fix() {
            return Err(E_NOT_FIX);
        }
        let target = core.nth(msg, PLUS_2);
        if !target.is_cap() {
            return Err(E_NOT_CAP);
        }
        let msg = core.nth(msg, PLUS_3);
        let delayed = Quad::new_event(sponsor, target, msg);
        let ptr = core.reserve(&delayed)?;
        let stub = core.reserve_stub(device, ptr)?;
        self.set_timer(delay, stub);
        Ok(true)  // event handled.
    }
}
