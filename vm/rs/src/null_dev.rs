// The NullDevice does nothing, but returns success.

use crate::*;

#[derive(Clone, Copy)]
pub struct NullDevice {}
impl NullDevice {
    pub const fn new() -> NullDevice {
        NullDevice {}
    }
}
impl Device for NullDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let _event = core.mem(ep);
        Ok(())  // event handled.
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn null_dev_always_succeeds() {
        static mut NULL_DEV: NullDevice = NullDevice::new();
        let mut core = Core::default();
        assert_eq!((), unsafe { NULL_DEV.handle_event(&mut core, UNDEF) }.unwrap() );
        assert_eq!(0, ::core::mem::size_of::<NullDevice>());
    }

}
