#![cfg_attr(feature = "no_std", no_std)]

extern crate alloc;

pub mod any;
pub mod core;
pub mod device;
pub mod quad;

use crate::any::*;
use crate::core::*;
use crate::quad::*;

pub type Error = i32;
pub const E_OK: Error       = 0;    // not an error
pub const E_FAIL: Error     = -1;   // general failure
pub const E_BOUNDS: Error   = -2;   // out of bounds
pub const E_NO_MEM: Error   = -3;   // no memory available
pub const E_NOT_FIX: Error  = -4;   // fixnum required
pub const E_NOT_CAP: Error  = -5;   // capability required
pub const E_NOT_PTR: Error  = -6;   // memory pointer required
pub const E_NOT_ROM: Error  = -7;   // ROM pointer required
pub const E_NOT_RAM: Error  = -8;   // RAM pointer required
pub const E_NOT_EXE: Error  = -9;   // instruction required
pub const E_NO_TYPE: Error  = -10;  // type required
pub const E_MEM_LIM: Error  = -11;  // Sponsor memory limit reached
pub const E_CPU_LIM: Error  = -12;  // Sponsor instruction limit reached
pub const E_MSG_LIM: Error  = -13;  // Sponsor event limit reached
pub const E_ASSERT: Error   = -14;  // assertion failed
pub const E_STOP: Error     = -15;  // actor stopped

pub type Raw = u32;  // univeral value type
pub type Num = i32;  // fixnum integer type

// type-tag bits
pub const MSK_RAW: Raw          = 0xF000_0000;  // mask for type-tag bits
pub const DIR_RAW: Raw          = 0x8000_0000;  // 1=direct (fixnum), 0=indirect (pointer)
pub const MUT_RAW: Raw          = 0x4000_0000;  // 1=read-write (mutable), 0=read-only (immutable)
pub const OPQ_RAW: Raw          = 0x2000_0000;  // 1=opaque (capability), 0=transparent (navigable)
