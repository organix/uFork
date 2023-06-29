// uFork device interfaces

use crate::*;

pub trait Device {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error>;
    fn drop_proxy(&mut self, _ptr: Any) {}  // default: no-op
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
        let message = event.y();  // message
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
        let cust = event.y();  // cust
        let now = self.read_clock();
        core.event_inject(sponsor, cust, now)?;
        Ok(true)  // event handled.
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
    fn write(&mut self, code: isize) {
        unsafe {
            crate::host_write(code);
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn write(&mut self, code: isize) {
        // console output not available...
        let _ = code;  // place a breakpoint on this assignment
    }

    #[cfg(target_arch = "wasm32")]
    fn read(&mut self, stub: Any) -> bool {
        unsafe {
            crate::host_read(stub.raw())
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn read(&mut self, _stub: Any) -> bool {
        // console input not available...
        false
    }
}
/*
    The present `IoDevice` is an experimental place-holder
    used to dump a _blob_ proxy to the debugger console.
    For backward compatibility, when the message is just a capability
    we retain the previous behavior.

    The new `IoDevice` interface follows the _Requestor_ pattern
    and provides a simple fixnum read/write API.

    A _read_ request looks like `(to_cancel callback)`,
    where `to_cancel` is the optional customer for a cancel capability,
    and `callback` is the customer that will receive the result.
    The result looks like `(fixnum)` on success,
    and `(#? . reason)` on failure.

    A _write_ request looks like `(to_cancel callback fixnum)`,
    where `to_cancel` is the optional customer for a cancel capability,
    and `callback` is the customer that will receive the result.
    The result looks like `(#unit)` on success,
    and `(#? . reason)` on failure.

    In either request, if `to_cancel` is a capability,
    the device **may** send a _cancel_ capability to that customer.
    If the _cancel_ capability is sent a message (any message),
    the request **may** be cancelled, if it has not already sent a result.
    NOTE: The initial implementation doesn't send a _cancel_ capability.
*/
impl Device for IoDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
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
                let delayed = Quad::new_event(sponsor, callback, UNDEF);
                let ptr = core.reserve(&delayed)?;
                let stub = core.reserve_stub(dev, ptr)?;
                if !self.read(stub) {
                    // reply immediately with failure
                    let reason = core.reserve(&Quad::pair_t(Any::fix(E_FAIL as isize), NIL))?;
                    let result = core.reserve(&Quad::pair_t(UNDEF, reason))?;  // (#undef error_code)
                    core.event_inject(sponsor, callback, result)?;
                    core.release_stub(stub);
                }
            } else if data.is_fix() {  // (to_cancel callback fixnum)
                // write request
                let code = data.get_fix()?;
                self.write(code);
                // in the current implementation, `write` is synchronous, so we reply immediately
                let result = core.reserve(&Quad::pair_t(UNIT, NIL))?;  // (#unit)
                core.event_inject(sponsor, callback, result)?;
            }
        }
        // NOTE: unrecognized messages may be ignored
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
}
/*
    The `BlobDevice` manages dynamically-allocated byte-arrays.
    There is a moderate (~64K maximum) allocation size limit.
    Each allocation is an actor/capability that implements
    random-access byte _read_ and _write_ requests.

    A _size_ request looks like `(customer)`.
    The number of bytes in this allocation
    is sent to the `customer` as a fixnum.

    A _read_ request looks like `(customer offset)`.
    The byte value at `offset` is sent to the `customer`.
    If `offset` is out of bounds, the value is `#?`.

    A _write_ request looks like `(customer offset value)`.
    The byte `value` is written at `offset`,
    and `#unit` is sent to the `customer`.
    If `offset` is out of bounds, the write has no effect.
*/
impl Device for BlobDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
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
                core.event_inject(sponsor, cust, size)?;
            } else if val == UNDEF {  // read request
                let data = blob_read(core, handle, ofs)?;
                core.event_inject(sponsor, cust, data)?;
            } else {  // write request
                let unit = blob_write(core, handle, ofs, val)?;
                core.event_inject(sponsor, cust, unit)?;
            }
        } else {
            // request to allocator
            let msg = event.y();  // (cust size)
            let cust = core.nth(msg, PLUS_1);
            let size = core.nth(msg, PLUS_2);
            let handle = blob_reserve(core, size)?;
            let proxy = Quad::proxy_t(target, handle);
            let ptr = core.reserve(&proxy)?;  // no Sponsor needed
            let cap = core.ptr_to_cap(ptr);
            core.event_inject(sponsor, cust, cap)?;
        }
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
        let dev = event.x();
        let msg = event.y();  // (delay target message)
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
        let stub = core.reserve_stub(dev, ptr)?;
        self.set_timer(delay, stub);
        Ok(true)  // event handled.
    }
}

pub struct AwpDevice {}
impl AwpDevice {
    pub fn new() -> AwpDevice {
        AwpDevice {}
    }
    #[cfg(target_arch = "wasm32")]
    fn forward_event(&mut self, event_stub_or_proxy: Any) -> Error {
        unsafe {
            crate::host_awp(event_stub_or_proxy.raw())
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    fn forward_event(&mut self, _event_stub_or_proxy: Any) -> Error {
        // AWP device not available...
        E_OK
    }
}
impl Device for AwpDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        let device = event.x();
        let event_stub = core.reserve_stub(device, ep)?;
        match self.forward_event(event_stub) {
            E_OK => Ok(true),
            code => Err(code)
        }
    }
    fn drop_proxy(&mut self, proxy: Any) {
        self.forward_event(proxy);
    }
}
