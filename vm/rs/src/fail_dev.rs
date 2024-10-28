// The FailDevice does nothing, but returns failure.

use crate::*;

#[derive(Clone, Copy)]
pub struct FailDevice {}
impl FailDevice {
    pub const fn new() -> FailDevice {
        FailDevice {}
    }
}
impl Device for FailDevice {
    fn handle_event(&mut self, core: &mut Core, ep: Any) -> Result<(), Error> {
        let _event = core.mem(ep);
        Err(E_FAIL)  // force failure...
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fail_dev_always_fails() {
        static mut FAIL_DEV: FailDevice = FailDevice::new();
        let mut core = Core::default();
        assert_eq!(E_FAIL, unsafe { FAIL_DEV.handle_event(&mut core, UNDEF) }.unwrap_err() );
        assert_eq!(0, ::core::mem::size_of::<FailDevice>());
    }

}
