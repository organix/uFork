// The BlobDevice manages byte-vector allocations.
// The interface is described in `blob_dev.md`.

use crate::*;

//const BLOB_RAM_MAX: usize = 64;     // 64 octets of Blob RAM (for testing)
//const BLOB_RAM_MAX: usize = 1<<8;   // 256 octets of Blob RAM (for testing)
//const BLOB_RAM_MAX: usize = 1<<10;  // 1K octets of Blob RAM
//const BLOB_RAM_MAX: usize = 1<<12;  // 4K octets of Blob RAM
//const BLOB_RAM_MAX: usize = 1<<14;  // 16K octets of Blob RAM
const BLOB_RAM_MAX: usize = 1<<16;  // 64K octets of Blob RAM (maximum value)

// OED-encoded types
const OED_POS_INT: u8 =     0x82;   // Positive Integer
const OED_ARRAY: u8 =       0x88;   // Array
const OED_BLOB: u8 =        0x8A;   // Octet Blob
const OED_EXTENSION: u8 =   0x8B;   // Extension Blob
const OED_NULL: u8 =        0x8F;   // `null` octet

fn u16_lsb(nat: usize) -> u8 {
    (nat & 0xFF) as u8
}
fn u16_msb(nat: usize) -> u8 {
    ((nat >> 8) & 0xFF) as u8
}

#[derive(Clone, Copy)]
pub struct BlobDevice {
    blob_ram: [u8; BLOB_RAM_MAX],
}

impl BlobDevice {
    pub const fn new() -> BlobDevice {
        BlobDevice {
            blob_ram: [OED_NULL; BLOB_RAM_MAX],
        }
    }

    fn blob_reserve(&mut self, size: Any) -> Result<Any, Error> {
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
            assert_eq!(OED_EXTENSION, self.blob_ram[ofs]);  // Extension Blob
            ofs += 1;
            let next = self.get_u16(ofs);  // `meta` field is offset of next free Blob (or zero)
            ofs += 4;
            let free = self.get_u16(ofs);  // `size` field is the number of free octets in this Blob
            if need <= free {
                ofs += 4;
                let end = ofs + free;
                let split = free - need;
                self.set_u16(ofs - 4, split);  // adjust `size` field for Blob splitting
                ofs += split;
                self.blob_ram[ofs] = OED_BLOB;  // Blob
                ofs += 1;
                self.set_u16(ofs, need - 5);
                ofs += 4;
                let blob = Any::fix(ofs as isize);  // capture offset to user-managed data
                // FIXME: consider clearing memory (to `null`) during de-allocation instead...
                while ofs < end {
                    self.blob_ram[ofs] = 0;  // fill with zero octets
                    ofs += 1;
                }
                let count = self.get_u16(1);  // get number of Array elements
                self.set_u16(1, count + 1);  // add element for new Blob
                return Ok(blob)
            }
            ofs = next;
        }
        Err(E_NO_MEM)  // BLOB memory exhausted
    }

    fn blob_release(&mut self, handle: Any) -> Result<(), Error> {
        let pos = (handle.get_fix()? - 5) as usize;
        let count = self.get_u16(1);  // get number of Array elements
        let size = self.get_u16(5);  // get Array size in octets
        if (pos < 9) || (pos > size + 5) {
            return Err(E_BOUNDS);
        }
        let mut ofs: usize = 9;  // start after Array header
        while ofs > 0 {
            assert_eq!(OED_EXTENSION, self.blob_ram[ofs]);  // Extension Blob
            let next = self.get_u16(ofs + 1);  // `meta` field is offset of next free Blob (or zero)
            let free = self.get_u16(ofs + 5);  // `size` field is the number of free octets in this Blob
            if pos == (ofs + 9 + free) {
                // allocation immediately follows this free block
                let len = self.get_u16(pos + 1);  // `size` field is the number of data octets in this Blob
                let free_len = free + len + 5;
                if next == (pos + len + 5) {
                    // coalesce the following free block
                    let next_next = self.get_u16(next + 1);
                    let next_free = self.get_u16(next + 5);
                    self.set_u16(ofs + 1, next_next);
                    self.set_u16(ofs + 5, free_len + next_free + 9);
                    self.set_u16(1, count - 2);
                } else {
                    self.set_u16(ofs + 5, free_len);  // adjust the size of the preceeding free block
                    self.set_u16(1, count - 1);  // remove element for free'd Blob
                }
                return Ok(());
            } else if (next == 0) || (pos < next) {
                // allocation preceeds next free block
                let len = self.get_u16(pos + 1);  // `size` field is the number of data octets in this Blob
                self.blob_ram[pos] = OED_EXTENSION;  // Blob -> Extension Blob
                if next == (pos + len + 5) {
                    // coalesce the following free block
                    let next_next = self.get_u16(next + 1);
                    let next_free = self.get_u16(next + 5);
                    self.set_u16(pos + 1, next_next);
                    self.set_u16(pos + 5, len - 4 + next_free + 9);
                    self.set_u16(1, count - 1);
                } else {
                    self.set_u16(pos + 1, next);
                    self.set_u16(pos + 5, len - 4);
                }
                self.set_u16(ofs + 1, pos);  // link preceeding block to free'd allocation
                return Ok(());
            }
            ofs = next;
        }
        Ok(())
    }

    fn blob_dims(&self, handle: Any) -> Result<(usize, usize), Error> {
        assert_ne!(self.blob_ram[0], OED_NULL);  // verify init() has been called
        let pos = handle.get_fix()?;
        let top = BLOB_RAM_MAX as isize;
        if (pos < 5) || (pos >= top) {
            return Err(E_BOUNDS);  // bad handle
        }
        let base = pos as usize;
        let len = self.get_u16(base - 4);
        Ok((base, len))
    }

    fn blob_size(&self, handle: Any) -> Result<Any, Error> {
        let (_base, len) = self.blob_dims(handle)?;
        Ok(Any::fix(len as isize))
    }

    fn blob_read(&self, handle: Any, ofs: Any) -> Result<Any, Error> {
        let (base, len) = self.blob_dims(handle)?;
        match ofs.fix_num() {
            Some(idx) => {
                let ofs = idx as usize;
                if ofs < len {
                    let byte = self.blob_ram[base + ofs];
                    Ok(Any::fix(byte as isize))
                } else {
                    Ok(UNDEF)  // out-of-bounds
                }
            },
            None => Ok(UNDEF),  // fixnum expected
        }
    }

    fn blob_write(&mut self, handle: Any, ofs: Any, val: Any) -> Result<Any, Error> {
        let (base, len) = self.blob_dims(handle)?;
        match (ofs.fix_num(), val.fix_num()) {
            (Some(idx), Some(dat)) => {
                let ofs = idx as usize;
                if ofs < len {
                    let byte = dat as u8;
                    self.blob_ram[base + ofs] = byte;
                    Ok(TRUE)
                } else {
                    Ok(FALSE)  // out-of-bounds
                }
            },
            _ => Ok(UNDEF),  // bad parameters
        }
    }

    fn get_u16(&self, ofs: usize) -> usize {
        assert_eq!(OED_POS_INT, self.blob_ram[ofs + 0]);
        assert_eq!(16, self.blob_ram[ofs + 1]);  // size = 16 bits
        let lsb = self.blob_ram[ofs + 2] as usize;
        let msb = self.blob_ram[ofs + 3] as usize;
        (msb << 8) | lsb
    }

    fn set_u16(&mut self, ofs: usize, data: usize) {
        self.blob_ram[ofs + 0] = OED_POS_INT;
        self.blob_ram[ofs + 1] = 16;  // size = 16 bits
        self.blob_ram[ofs + 2] = u16_lsb(data);
        self.blob_ram[ofs + 3] = u16_msb(data);
    }

    pub fn blob_top(&self) -> Any {
        Any::fix(BLOB_RAM_MAX as isize)
    }
    pub fn read(&self, ofs: usize) -> u8 {
        self.blob_ram[ofs]
    }
    pub fn write(&mut self, ofs: usize, data: u8) {
        self.blob_ram[ofs] = data;
    }
    pub fn buffer(&self) -> &[u8] {
        &self.blob_ram
    }
}

impl Default for BlobDevice {
    fn default() -> Self {
        Self::new()
    }
}

impl Device for BlobDevice {
    fn init(&mut self) {
        /*
         * OED-encoded Blob Memory (64kB maximum)
         */
        let mut nat = BLOB_RAM_MAX;
        nat -= 9;
        self.blob_ram[0] = OED_ARRAY;       // Array
        self.blob_ram[1] = OED_POS_INT;     //   length: +Integer elements
        self.blob_ram[2] = 16;              //     length.size = 16 bits
        self.blob_ram[3] = 1;               //     length[0] = 1 (lsb)
        self.blob_ram[4] = 0;               //     length[1] = 0 (msb)
        self.blob_ram[5] = OED_POS_INT;     //   size: +Integer octets
        self.blob_ram[6] = 16;              //     size.size = 16 bits
        self.blob_ram[7] = u16_lsb(nat);    //     size[0] (lsb)
        self.blob_ram[8] = u16_msb(nat);    //     size[1] (msb)
        nat -= 9;
        self.blob_ram[9] = OED_EXTENSION;   //   [0] = Extension Blob
        self.blob_ram[10] = OED_POS_INT;    //       meta: +Integer offset
        self.blob_ram[11] = 16;             //         meta.size = 16 bits
        self.blob_ram[12] = 0;              //         meta[0] = 0 (lsb)
        self.blob_ram[13] = 0;              //         meta[1] = 0 (msb)
        self.blob_ram[14] = OED_POS_INT;    //       size: +Integer octets
        self.blob_ram[15] = 16;             //         size.size = 16 bits
        self.blob_ram[16] = u16_lsb(nat);   //         size[0] (lsb)
        self.blob_ram[17] = u16_msb(nat);   //         size[1] (msb)
    }
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
                let data = self.blob_read(handle, ofs)?;
                let evt = core.reserve_event(sponsor, cust, data)?;
                core.event_enqueue(evt);
            } else if core.typeq(PAIR_T, req) {  // write request
                let ofs = core.nth(req, PLUS_1);
                let val = core.nth(req, MINUS_1);
                let ok = self.blob_write(handle, ofs, val)?;
                let evt = core.reserve_event(sponsor, cust, ok)?;
                core.event_enqueue(evt);
            } else {  // size request
                let size = self.blob_size(handle)?;
                let evt = core.reserve_event(sponsor, cust, size)?;
                core.event_enqueue(evt);
            }
        } else {
            // request to allocator
            let msg = event.y();  // (cust size)
            let cust = core.nth(msg, PLUS_1);
            let size = core.nth(msg, MINUS_1);
            let handle = self.blob_reserve(size)?;
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
            let result = self.blob_release(handle);
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
        unsafe {
            DEV.init();
            DEV.drop_proxy(&mut core, UNDEF);
        }
        assert_ne!(0, ::core::mem::size_of::<BlobDevice>());
    }

}
