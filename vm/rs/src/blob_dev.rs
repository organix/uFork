// The BlobDevice manages byte-vector allocations.

use crate::*;

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
fn blob_dims(core: &Core, handle: Any) -> Result<(usize, usize), Error> {
    let pos = handle.get_fix()?;
    let top = core.blob_top().get_fix()?;
    if (pos < 5) || (pos >= top) {
        return Err(E_BOUNDS);  // bad handle
    }
    let base = pos as usize;
    let len = get_u16(core, base - 4);
    Ok((base, len))
}
fn blob_size(core: &Core, handle: Any) -> Result<Any, Error> {
    let (_base, len) = blob_dims(core, handle)?;
    Ok(Any::fix(len as isize))
}
fn blob_read(core: &Core, handle: Any, ofs: Any) -> Result<Any, Error> {
    let (base, len) = blob_dims(core, handle)?;
    match ofs.fix_num() {
        Some(idx) => {
            let ofs = idx as usize;
            if ofs < len {
                let byte = core.blob_read(base + ofs);
                Ok(Any::fix(byte as isize))
            } else {
                Ok(UNDEF)  // out-of-bounds
            }
        },
        None => Ok(UNDEF),  // fixnum expected
    }
}
fn blob_write(core: &mut Core, handle: Any, ofs: Any, val: Any) -> Result<Any, Error> {
    let (base, len) = blob_dims(core, handle)?;
    match (ofs.fix_num(), val.fix_num()) {
        (Some(idx), Some(dat)) => {
            let ofs = idx as usize;
            if ofs < len {
                let byte = dat as u8;
                core.blob_write(base + ofs, byte);
                Ok(TRUE)
            } else {
                Ok(FALSE)  // out-of-bounds
            }
        },
        _ => Ok(UNDEF),  // bad parameters
    }
}

#[derive(Clone, Copy, Default)]
pub struct BlobDevice {}
impl BlobDevice {
    pub const fn new() -> BlobDevice {
        BlobDevice {}
    }
}
/*
impl Default for BlobDevice {
    fn default() -> Self {
        Self::new()
    }
}
*/
/*
    The `BlobDevice` interface is described in blob_dev.md.
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
            let msg = event.y();  // (cust . #?) | (cust . ofs) | (cust ofs . val)
            let cust = core.nth(msg, PLUS_1);
            let req = core.nth(msg, MINUS_1);
            if req.is_fix() {  // read request
                let ofs = req;
                let data = blob_read(core, handle, ofs)?;
                let evt = core.reserve_event(sponsor, cust, data)?;
                core.event_enqueue(evt);
            } else if core.typeq(PAIR_T, req) {  // write request
                let ofs = core.nth(req, PLUS_1);
                let val = core.nth(req, MINUS_1);
                let ok = blob_write(core, handle, ofs, val)?;
                let evt = core.reserve_event(sponsor, cust, ok)?;
                core.event_enqueue(evt);
            } else {  // size request
                let size = blob_size(core, handle)?;
                let evt = core.reserve_event(sponsor, cust, size)?;
                core.event_enqueue(evt);
            }
        } else {
            // request to allocator
            let msg = event.y();  // (cust size)
            let cust = core.nth(msg, PLUS_1);
            let size = core.nth(msg, MINUS_1);
            let handle = blob_reserve(core, size)?;
            let proxy = core.reserve_proxy(target, handle)?;
            let evt = core.reserve_event(sponsor, cust, proxy)?;
            core.event_enqueue(evt);
        }
        Ok(())  // event handled.
    }
    fn drop_proxy(&mut self, core: &mut Core, proxy: Any) {
        if proxy.is_cap() {
            let ptr = core.cap_to_ptr(proxy);
            let handle = core.ram(ptr).y();
            let result = blob_release(core, handle);
            assert!(result.is_ok());    
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blob_dev_can_be_statically_allocated() {
        static mut DEV: BlobDevice = BlobDevice::new();
        let mut core = Core::default();
        unsafe { DEV.drop_proxy(&mut core, UNDEF) };
        assert_eq!(0, ::core::mem::size_of::<BlobDevice>());
    }

}
