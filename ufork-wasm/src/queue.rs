// fast hardware queue

use crate::ufork::*;

pub struct Queue { head: Ptr, tail: Ptr }
impl Queue {
    pub fn new() -> Queue {
        Queue::init(NIL.ptr(), NIL.ptr())
    }
    pub fn init(head: Ptr, tail: Ptr) -> Queue {
        Queue { head, tail }
    }
    pub fn empty(&self, core: &Core) -> bool {
        //NIL.ptr() == self.head
        !core.in_heap(self.head.val())
    }
    pub fn put(&mut self, core: &mut Core, ptr: Ptr) {
        let quad = core.quad_mut(ptr);
        quad.set_z(NIL);
        if self.empty(core) {
            self.head = ptr;
        } else {
            core.quad_mut(self.tail).set_z(ptr.val());
        }
        self.tail = ptr;
    }
    pub fn take(&mut self, core: &mut Core) -> Ptr {
        if self.empty(core) {
            return UNDEF.ptr();
        }
        let ptr = self.head;
        let quad = core.quad_mut(ptr);
        self.head = quad.z().ptr();
        quad.set_z(NIL);
        if self.empty(core) {
            self.tail = NIL.ptr();  // empty queue
        }
        ptr
    }
}
