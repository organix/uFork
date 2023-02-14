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
        //panic!();  // terminate simulator!
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

fn u16_lsb(nat: usize) -> u8 {
    (nat & 0xFF) as u8
}
fn u16_msb(nat: usize) -> u8 {
    ((nat >> 8) & 0xFF) as u8
}
const BLOB_RAM_MAX: usize = 64;  // 64 octets of BLOB RAM (for testing)
//const BLOB_RAM_MAX: usize = 1<<12;  // 4K octets of BLOB RAM
//const BLOB_RAM_MAX: usize = 1<<16;  // 64K octets of BLOB RAM
pub struct BlobDevice {
    blob_ram: [u8; BLOB_RAM_MAX],
}
impl BlobDevice {
    pub fn new() -> BlobDevice {
        let mut blob_ram = [
            0x8F as u8;  // fill with OED-encoded `null` octets
            BLOB_RAM_MAX
        ];
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
    let mut nat = BLOB_RAM_MAX;
    nat -= 9;
    blob_ram[0] = 0x88;                 // Array
    blob_ram[1] = 0x82;                 //   length: +Integer elements
    blob_ram[2] = 16;                   //     length.size = 16 bits
    blob_ram[3] = 1;                    //     length[0] = 1 (lsb)
    blob_ram[4] = 0;                    //     length[1] = 0 (msb)
    blob_ram[5] = 0x82;                 //   size: +Integer octets
    blob_ram[6] = 16;                   //     size.size = 16 bits
    blob_ram[7] = u16_lsb(nat);         //     size[0] (lsb)
    blob_ram[8] = u16_msb(nat);         //     size[1] (msb)
    nat -= 9;
    blob_ram[9] = 0x8B;                 //   [0] = Extension Blob
    blob_ram[10] = 0x82;                //       meta: +Integer offset
    blob_ram[11] = 16;                  //         meta.size = 16 bits
    blob_ram[12] = 0;                   //         meta[0] = 0 (lsb)
    blob_ram[13] = 0;                   //         meta[1] = 0 (msb)
    blob_ram[14] = 0x82;                //       size: +Integer octets
    blob_ram[15] = 16;                  //         size.size = 16 bits
    blob_ram[16] = u16_lsb(nat);        //         size[0] (lsb)
    blob_ram[17] = u16_msb(nat);        //         size[1] (msb)
    BlobDevice {
            blob_ram,
        }
    }
    fn get_u16(&self, ofs: usize) -> usize {
        assert_eq!(0x82, self.blob_ram[ofs + 0]);  // +Integer
        assert_eq!(16, self.blob_ram[ofs + 1]);  // size = 16 bits
        let lsb = self.blob_ram[ofs + 2] as usize;
        let msb = self.blob_ram[ofs + 3] as usize;
        (msb << 8) | lsb
    }
    fn set_u16(&mut self, ofs: usize, data: usize) {
        self.blob_ram[ofs + 0] = 0x82;  // +Integer
        self.blob_ram[ofs + 1] = 16;  // size = 16 bits
        self.blob_ram[ofs + 2] = u16_lsb(data);
        self.blob_ram[ofs + 3] = u16_msb(data);
    }
    fn reserve(&mut self, size: Any) -> Result<Any, Error> {
        let mut need = size.get_fix()? as usize;
        if need < 4 {
            need = 4;  // minimum allocation is 4 octets
        }
        need += 5;  // adjust for Blob header
        let mut ofs: usize = 9;  // start after Array header
        while ofs > 0 {
            assert_eq!(0x8B, self.blob_ram[ofs]);  // Extension Blob
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
                self.blob_ram[ofs] = 0x8A;  // Blob
                ofs += 1;
                self.set_u16(ofs, need - 5);
                ofs += 4;
                let blob = Any::fix(ofs as isize);  // capture offset to user-managed data
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
        Err(String::from("BLOB memory exhausted"))
    }
}
impl Device for BlobDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<bool, Error> {
        let event = core.mem(ep);
        println!("BlobDevice::handle_event: event={} -> {}", ep, event);
        let sponsor = event.t();
        let msg = event.y();
        let cust = core.car(msg);
        let size = core.car(core.cdr(msg));
        println!("BlobDevice::handle_event: cust={}, size={}", cust, size);
        let reply = self.reserve(size)?;
        core.event_inject(sponsor, cust, reply)?;
        Ok(true)  // event handled.
    }
}
