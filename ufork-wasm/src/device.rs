// uFork device interfaces

use crate::*;

pub trait Device {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error>;
    fn drop_proxy(&mut self, _core: &mut Core, _cap: Any) {}  // default: no-op
}

pub struct NullDevice {}
impl NullDevice {
    pub fn new() -> NullDevice {
        NullDevice {}
    }
}
impl Device for NullDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let _event = core.mem(ep);
        //panic!();  // terminate simulator!
        //Err(E_FAIL)  // force failure...
        Ok(())  // event handled.
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
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let message = event.y();  // message
        self.debug_print(message);
        Ok(())  // event handled.
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
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let cust = event.y();  // cust
        let now = self.read_clock();
        let evt = core.reserve_event(sponsor, cust, now)?;
        core.event_enqueue(evt);
        Ok(())  // event handled.
    }
}

pub struct RandomDevice {}
impl RandomDevice {
    pub fn new() -> RandomDevice {
        RandomDevice {}
    }
    #[cfg(target_arch = "wasm32")]
    fn get_random(&mut self, a: Any, b: Any) -> Any {
        unsafe {
            let raw = crate::host_random(a.raw(), b.raw());
            Any::fix(raw as isize)
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn get_random(&mut self, a: Any, b: Any) -> Any {
        // randomness not available...
        if b.is_fix() {
            return b;
        }
        if a.is_fix() {
            return a;
        }
        Any::fix(0)
    }
}
impl Device for RandomDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let msg = event.y();  // (cust) | (cust size) | (cust a b)
        let cust = core.nth(msg, PLUS_1);
        let a = core.nth(msg, PLUS_2);
        let b = core.nth(msg, PLUS_3);
        let random = self.get_random(a, b);
        let evt = core.reserve_event(sponsor, cust, random)?;
        core.event_enqueue(evt);
        Ok(())  // event handled.
    }
}

pub struct IoDevice {}
impl IoDevice {
    pub fn new() -> IoDevice {
        IoDevice {}
    }

    #[cfg(target_arch = "wasm32")]
    fn dump_blob(&mut self, base: *const u8, ofs: usize) {
        unsafe {
            crate::host_print(base, ofs);
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn dump_blob(&mut self, _base: *const u8, _ofs: usize) {
        //println!("LOG: {}[{}]", base as usize, ofs);
        // FIXME: console i/o not available in `#![no_std]` build
    }

    #[cfg(target_arch = "wasm32")]
    fn write(&mut self, code: Any) -> Any {
        unsafe {
            let raw = crate::host_write(code.raw());
            Any::new(raw)
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn write(&mut self, code: Any) -> Any {
        // console output not available...
        let _ = code;  // place a breakpoint on this assignment
        Any::fix(E_OK as isize)
    }

    #[cfg(target_arch = "wasm32")]
    fn read(&mut self, stub: Any) -> Any {
        unsafe {
            let raw = crate::host_read(stub.raw());
            Any::new(raw)
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn read(&mut self, _stub: Any) -> Any {
        // console input not available...
        UNDEF
    }
}
/*
    The old `IoDevice` was an experimental place-holder
    used to dump a _blob_ proxy to the debugger console.
    For backward compatibility, when the message is just a capability
    we retain the previous behavior.

    The new `IoDevice` interface is described in [io_dev.md](io_dev.md)
      * _read_: `(to_cancel callback)` → `(fixnum)` | `(#? . error)`
      * _write_: `(to_cancel callback fixnum)` → `(#unit)` | `(#? . error)`
      * _cancel_: `_` → `to_cancel`
*/
impl Device for IoDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let dev = event.x();
        let msg = event.y();  // blob | (to_cancel callback) | (to_cancel callback fixnum)
        if msg.is_cap() {  // blob
            let buf = core.blob_buffer();
            let base = buf.as_ptr();
            let ptr = core.cap_to_ptr(msg);
            let proxy = core.ram(ptr);
            if proxy.t() != PROXY_T {
                return Err(E_NOT_PTR);
            }
            if proxy.x() != BLOB_DEV {
                return Err(E_BOUNDS);
            }
            let ofs = proxy.y().get_fix()? as usize;
            self.dump_blob(base, ofs);
        } else if core.typeq(PAIR_T, msg) {
            let _to_cancel = core.nth(msg, PLUS_1);
            // FIXME: cancel option not implemented
            let callback = core.nth(msg, PLUS_2);
            if !callback.is_cap() {
                return Err(E_NOT_CAP);
            }
            let data = core.nth(msg, PLUS_3);
            if data == UNDEF {  // (to_cancel callback)
                // read request
                let evt = core.reserve_event(sponsor, callback, UNDEF)?;
                let stub = core.reserve_stub(dev, evt)?;
                let char = self.read(stub);
                if char.is_fix() {
                    // if `read` was synchronous, reply immediately
                    let result = core.reserve(&Quad::pair_t(char, NIL))?;  // (char)
                    core.ram_mut(evt).set_y(result);  // msg = result
                    core.event_enqueue(evt);
                    core.release_stub(stub);
                }
            } else if data.is_fix() {  // (to_cancel callback fixnum)
                // write request
                self.write(data);
                // in the current implementation, `write` is synchronous, so we reply immediately
                let result = core.reserve(&Quad::pair_t(UNIT, NIL))?;  // (#unit)
                let evt = core.reserve_event(sponsor, callback, result)?;
                core.event_enqueue(evt);
            }
        }
        // NOTE: unrecognized messages may be ignored
        Ok(())  // event handled.
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
fn blob_reserve(core: &mut Core, size: Any) -> Result<Any, Error> {
    let mut need = size.get_fix()? as usize;
    if need > 0xFFFF_FFF0 {
        return Err(E_BOUNDS);  // ~64K maximum allocation
    }
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
fn blob_release(core: &mut Core, handle: Any) -> Result<(), Error> {
    let pos = (handle.get_fix()? - 5) as usize;
    let count = get_u16(core, 1);  // get number of Array elements
    let size = get_u16(core, 5);  // get Array size in octets
    if (pos < 9) || (pos > size + 5) {
        return Err(E_BOUNDS);
    }
    let mut ofs: usize = 9;  // start after Array header
    while ofs > 0 {
        assert_eq!(0x8B, core.blob_read(ofs));  // Extension Blob
        let next = get_u16(core, ofs + 1);  // `meta` field is offset of next free Blob (or zero)
        let free = get_u16(core, ofs + 5);  // `size` field is the number of free octets in this Blob
        if pos == (ofs + 9 + free) {
            // allocation immediately follows this free block
            let len = get_u16(core, pos + 1);  // `size` field is the number of data octets in this Blob
            let free_len = free + len + 5;
            if next == (pos + len + 5) {
                // coalesce the following free block
                let next_next = get_u16(core, next + 1);
                let next_free = get_u16(core, next + 5);
                set_u16(core, ofs + 1, next_next);
                set_u16(core, ofs + 5, free_len + next_free + 9);
                set_u16(core, 1, count - 2);
            } else {
                set_u16(core, ofs + 5, free_len);  // adjust the size of the preceeding free block
                set_u16(core, 1, count - 1);  // remove element for free'd Blob
            }
            return Ok(());
        } else if (next == 0) || (pos < next) {
            // allocation preceeds next free block
            let len = get_u16(core, pos + 1);  // `size` field is the number of data octets in this Blob
            core.blob_write(pos, 0x8B);  // Blob -> Extension Blob
            if next == (pos + len + 5) {
                // coalesce the following free block
                let next_next = get_u16(core, next + 1);
                let next_free = get_u16(core, next + 5);
                set_u16(core, pos + 1, next_next);
                set_u16(core, pos + 5, len - 4 + next_free + 9);
                set_u16(core, 1, count - 1);
            } else {
                set_u16(core, pos + 1, next);
                set_u16(core, pos + 5, len - 4);
            }
            set_u16(core, ofs + 1, pos);  // link preceeding block to free'd allocation
            return Ok(());
        }
        ofs = next;
    }
    Ok(())
}
fn blob_size(core: &Core, handle: Any) -> Result<Any, Error> {
    let pos = handle.get_fix()?;
    let top = core.blob_top().get_fix()?;
    if (pos < 5) || (pos >= top) {
        return Err(E_BOUNDS);
    }
    let base = pos as usize;
    let len = get_u16(core, base - 4);
    Ok(Any::fix(len as isize))
}
fn blob_read(core: &Core, handle: Any, ofs: Any) -> Result<Any, Error> {
    let pos = handle.get_fix()?;
    let top = core.blob_top().get_fix()?;
    if (pos < 5) || (pos >= top) {
        return Err(E_BOUNDS);
    }
    let base = pos as usize;
    let len = get_u16(core, base - 4);
    let ofs = ofs.get_fix()? as usize;
    if ofs >= len {
        return Ok(UNDEF);
    }
    let byte = core.blob_read(base + ofs);
    Ok(Any::fix(byte as isize))
}
fn blob_write(core: &mut Core, handle: Any, ofs: Any, val: Any) -> Result<Any, Error> {
    let pos = handle.get_fix()?;
    let top = core.blob_top().get_fix()?;
    if (pos < 5) || (pos >= top) {
        return Err(E_BOUNDS);
    }
    let base = pos as usize;
    let len = get_u16(core, base - 4);
    let ofs = ofs.get_fix()? as usize;
    if ofs < len {
        let byte = val.get_fix()? as u8;
        core.blob_write(base + ofs, byte);
    }
    Ok(UNIT)
}
pub struct BlobDevice {}
impl BlobDevice {
    pub fn new() -> BlobDevice {
        BlobDevice {}
    }
    #[cfg(target_arch = "wasm32")]
    fn log_proxy(&mut self, proxy: Any) {
        let raw = proxy.raw();
        unsafe {
            crate::host_log(raw);
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn log_proxy(&mut self, proxy: Any) {
        let raw = proxy.raw();
        let _dev = raw & !MSK_RAW;
    }
}
/*
    The `BlobDevice` interface is described in [blob_dev.md](blob_dev.md)
*/
impl Device for BlobDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let target = event.x();
        let myself = core.ram(core.cap_to_ptr(target));
        if myself.t() == PROXY_T {
            // request to allocated blob
            let _dev = myself.x();
            let handle = myself.y();
            let msg = event.y();  // (cust) | (cust ofs) | (cust ofs val)
            let cust = core.nth(msg, PLUS_1);
            let ofs: Any = core.nth(msg, PLUS_2);
            let val: Any = core.nth(msg, PLUS_3);
            if ofs == UNDEF {  // size request
                let size = blob_size(core, handle)?;
                let evt = core.reserve_event(sponsor, cust, size)?;
                core.event_enqueue(evt);
            } else if val == UNDEF {  // read request
                let data = blob_read(core, handle, ofs)?;
                let evt = core.reserve_event(sponsor, cust, data)?;
                core.event_enqueue(evt);
            } else {  // write request
                let unit = blob_write(core, handle, ofs, val)?;
                let evt = core.reserve_event(sponsor, cust, unit)?;
                core.event_enqueue(evt);
            }
        } else {
            // request to allocator
            let msg = event.y();  // (cust size)
            let cust = core.nth(msg, PLUS_1);
            let size = core.nth(msg, PLUS_2);
            let handle = blob_reserve(core, size)?;
            let proxy = core.reserve_proxy(target, handle)?;
            let evt = core.reserve_event(sponsor, cust, proxy)?;
            core.event_enqueue(evt);
        }
        Ok(())  // event handled.
    }
    fn drop_proxy(&mut self, core: &mut Core, proxy: Any) {
        self.log_proxy(proxy);
        let ptr = core.cap_to_ptr(proxy);
        let handle = core.ram(ptr).y();
        let result = blob_release(core, handle);
        assert!(result.is_ok());
    }
}

pub struct TimerDevice {}
impl TimerDevice {
    pub fn new() -> TimerDevice {
        TimerDevice {}
    }
    #[cfg(target_arch = "wasm32")]
    fn start_timer(&mut self, delay: Any, stub: Any) {
        unsafe {
            crate::host_start_timer(delay.raw(), stub.raw());
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn start_timer(&mut self, _delay: Any, _stub: Any) {
        // timer device not available...
    }
    #[cfg(target_arch = "wasm32")]
    fn stop_timer(&mut self, stub: Any) -> bool {
        unsafe {
            crate::host_stop_timer(stub.raw())
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn stop_timer(&mut self, _stub: Any) -> bool {
        // timer device not available...
        false
    }
}
impl Device for TimerDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let sponsor = event.t();
        let dev = event.x();
        let msg = event.y();
        let ptr = core.cap_to_ptr(dev);
        let myself = core.ram(ptr);
        if myself.t() == PROXY_T {
            // stop timer request
            let handle = myself.y();
            if handle.is_ram() {
                if self.stop_timer(handle) {
                    core.release_stub(handle);
                }
                core.ram_mut(ptr).set_y(UNDEF);
            }
        } else {
            // start timer request
            let arg_1 = core.nth(msg, PLUS_1);
            if arg_1.is_fix() {  // simple delayed message
                // (delay target message)
                let delay = arg_1;
                let target = core.nth(msg, PLUS_2);
                if !target.is_cap() {
                    return Err(E_NOT_CAP);
                }
                let message = core.nth(msg, PLUS_3);
                let delayed = Quad::new_event(sponsor, target, message);
                let ptr = core.reserve(&delayed)?;
                let stub = core.reserve_stub(dev, ptr)?;
                self.start_timer(delay, stub);
            } else {  // requestor-style interface
                // (to_cancel callback delay . result)
                let to_cancel = arg_1;
                let callback = core.nth(msg, PLUS_2);
                if !callback.is_cap() {
                    return Err(E_NOT_CAP);
                }
                let delay = core.nth(msg, PLUS_3);
                if !delay.is_fix() {
                    return Err(E_NOT_FIX);
                }
                let result = core.nth(msg, MINUS_3);
                let delayed = Quad::new_event(sponsor, callback, result);
                let ptr = core.reserve(&delayed)?;
                let stub = core.reserve_stub(dev, ptr)?;
                self.start_timer(delay, stub);
                if to_cancel.is_cap() {
                    let proxy = core.reserve_proxy(dev, stub)?;
                    let evt = core.reserve_event(sponsor, to_cancel, proxy)?;
                    core.event_enqueue(evt);
                }
            }
        }
        Ok(())  // event handled.
    }
}

pub struct HostDevice {}
impl HostDevice {
    pub fn new() -> HostDevice {
        HostDevice {}
    }
    #[cfg(target_arch = "wasm32")]
    fn to_host(&mut self, event_stub_or_proxy: Any) -> Error {
        unsafe {
            crate::host(event_stub_or_proxy.raw())
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn to_host(&mut self, _event_stub_or_proxy: Any) -> Error {
        // host device not available...
        E_OK
    }
}
impl Device for HostDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let event = core.mem(ep);
        let device = event.x();
        let event_stub = core.reserve_stub(device, ep)?;
        match self.to_host(event_stub) {
            E_OK => Ok(()),
            code => {
                core.release_stub(event_stub);
                Err(code)
            }
        }
    }
    fn drop_proxy(&mut self, _core: &mut Core, proxy: Any) {
        self.to_host(proxy);
    }
}
