// A set of 4 named `Any` values (minimum addressable unit of memory)

use crate::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
// quad-cell (minimum addressable unit)
pub struct Quad {
    t: Any,
    x: Any,
    y: Any,
    z: Any,
}

impl Quad {
    pub fn new(t: Any, x: Any, y: Any, z: Any) -> Quad {
        Quad { t, x, y, z }
    }
    pub fn t(&self) -> Any { self.t }
    pub fn x(&self) -> Any { self.x }
    pub fn y(&self) -> Any { self.y }
    pub fn z(&self) -> Any { self.z }
    pub fn set_t(&mut self, v: Any) { self.t = v; }
    pub fn set_x(&mut self, v: Any) { self.x = v; }
    pub fn set_y(&mut self, v: Any) { self.y = v; }
    pub fn set_z(&mut self, v: Any) { self.z = v; }

    // construct basic Quad types
    pub fn empty_t() -> Quad {
        Self::new(UNDEF, UNDEF, UNDEF, UNDEF)
    }
    pub fn literal_t() -> Quad {
        Self::new(LITERAL_T, UNDEF, UNDEF, UNDEF)
    }
    pub fn type_t(n: Any) -> Quad {
        Self::new(TYPE_T, n, UNDEF, UNDEF)
    }
    pub fn event_t(sponsor: Any, target: Any, msg: Any, next: Any) -> Quad {
        assert!(sponsor.is_ram());
        assert!(target.is_cap());
        assert!(next.is_ptr());
        Self::new(sponsor, target, msg, next)
    }
    pub fn cont_t(ip: Any, sp: Any, ep: Any, next: Any) -> Quad {
        assert!(ip.is_ptr());
        assert!(sp.is_ptr());
        assert!(ep.is_ram());
        assert!(next.is_ptr());
        Self::new(ip, sp, ep, next)
    }
    pub fn instr_t(op: Any, imm: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::new(INSTR_T, op, imm, k)
    }
    pub fn actor_t(beh: Any, state: Any, events: Any) -> Quad {
        //assert!(beh.is_ptr()); --- moved test to new_actor() so we can create devices
        assert!(events.is_ptr());
        Self::new(ACTOR_T, beh, state, events)
    }
    pub fn proxy_t(device: Any, handle: Any) -> Quad {
        assert!(device.is_cap());
        Self::new(PROXY_T, device, handle, UNDEF)
    }
    pub fn stub_t(device: Any, target: Any) -> Quad {
        assert!(device.is_cap());
        Self::new(STUB_T, device, target, NIL)
    }
    pub fn pair_t(car: Any, cdr: Any) -> Quad {
        Self::new(PAIR_T, car, cdr, UNDEF)
    }
    pub fn dict_t(key: Any, value: Any, next: Any) -> Quad {
        assert!(next.is_ptr());
        Self::new(DICT_T, key, value, next)
    }
    pub fn free_t(next: Any) -> Quad {
        Self::new(FREE_T, UNDEF, UNDEF, next)
    }
    pub fn ddeque_t(e_first: Any, e_last: Any, k_first: Any, k_last: Any) -> Quad {
        assert!(e_first.is_ptr());
        assert!(e_last.is_ptr());
        assert!(k_first.is_ptr());
        assert!(k_last.is_ptr());
        Self::new(e_first, e_last, k_first, k_last)
    }
    pub fn memory_t(top: Any, next: Any, free: Any, root: Any) -> Quad {
        assert!(top.is_ptr());
        assert!(next.is_ptr());
        assert!(free.is_fix());
        assert!(root.is_ptr());
        Self::new(top, next, free, root)
    }
    pub fn sponsor_t(memory: Any, events: Any, cycles: Any, signal: Any) -> Quad {
        assert!(memory.is_fix());
        assert!(events.is_fix());
        assert!(cycles.is_fix());
        Self::new(memory, events, cycles, signal)
    }
    pub fn fwd_ref_t(to: Any) -> Quad {
        Self::new(FWD_REF_T, UNDEF, UNDEF, to)
    }
    pub fn untyped_t(t: Any, x: Any, y: Any, z: Any) -> Quad {  // pass-thru for Quad::new()
        Self::new(t, x, y, z)
    }

    // construct VM instructions types
    pub fn vm_typeq(t: Any, k: Any) -> Quad {
        assert!(t.is_ptr());
        assert!(k.is_ptr());
        Self::instr_t(VM_TYPEQ, t, k)
    }
    pub fn vm_quad(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_QUAD, n, k)
    }
    pub fn vm_dict(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DICT, op, k)
    }
    pub fn vm_deque(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DEQUE, op, k)
    }
    pub fn vm_pair(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_PAIR, n, k)
    }
    pub fn vm_part(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_PART, n, k)
    }
    pub fn vm_nth(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_NTH, n, k)
    }
    pub fn vm_push(v: Any, k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::instr_t(VM_PUSH, v, k)
    }
    pub fn vm_jump() -> Quad {
        Self::instr_t(VM_JUMP, UNDEF, UNDEF)
    }
    pub fn vm_drop(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DROP, n, k)
    }
    pub fn vm_pick(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_PICK, n, k)
    }
    pub fn vm_dup(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_DUP, n, k)
    }
    pub fn vm_roll(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_ROLL, n, k)
    }
    pub fn vm_alu(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_ALU, op, k)
    }
    pub fn vm_eq(v: Any, k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::instr_t(VM_EQ, v, k)
    }
    pub fn vm_cmp(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_CMP, op, k)
    }
    pub fn vm_if(t: Any, f: Any) -> Quad {
        assert!(t.is_ptr());
        assert!(f.is_ptr());
        Self::instr_t(VM_IF, t, f)
    }
    pub fn vm_msg(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_MSG, n, k)
    }
    pub fn vm_state(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_STATE, n, k)
    }
    pub fn vm_my(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_MY, op, k)
    }
    pub fn vm_send(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_SEND, n, k)
    }
    pub fn vm_new(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_NEW, n, k)
    }
    pub fn vm_beh(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_BEH, n, k)
    }
    pub fn vm_signal(n: Any, k: Any) -> Quad {
        assert!(n.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_SIGNAL, n, k)
    }
    pub fn vm_end(op: Any) -> Quad {
        assert!(op.is_fix());
        Self::instr_t(VM_END, op, UNDEF)
    }
    pub fn vm_sponsor(op: Any, k: Any) -> Quad {
        assert!(op.is_fix());
        assert!(k.is_ptr());
        Self::instr_t(VM_SPONSOR, op, k)
    }
    pub fn vm_assert(v: Any, k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::instr_t(VM_ASSERT, v, k)
    }

    // construct VM_DICT instructions
    pub fn vm_dict_has(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_HAS, k)
    }
    pub fn vm_dict_get(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_GET, k)
    }
    pub fn vm_dict_add(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_ADD, k)
    }
    pub fn vm_dict_set(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_SET, k)
    }
    pub fn vm_dict_del(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_dict(DICT_DEL, k)
    }

    // construct VM_DEQUE instructions
    pub fn vm_deque_new(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_NEW, k)
    }
    pub fn vm_deque_empty(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_EMPTY, k)
    }
    pub fn vm_deque_push(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_PUSH, k)
    }
    pub fn vm_deque_pop(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_POP, k)
    }
    pub fn vm_deque_put(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_PUT, k)
    }
    pub fn vm_deque_pull(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_PULL, k)
    }
    pub fn vm_deque_len(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_deque(DEQUE_LEN, k)
    }

    // construct VM_ALU instructions
    pub fn vm_alu_not(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_NOT, k)
    }
    pub fn vm_alu_and(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_AND, k)
    }
    pub fn vm_alu_or(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_OR, k)
    }
    pub fn vm_alu_xor(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_XOR, k)
    }
    pub fn vm_alu_add(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_ADD, k)
    }
    pub fn vm_alu_sub(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_SUB, k)
    }
    pub fn vm_alu_mul(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_alu(ALU_MUL, k)
    }

    // construct VM_CMP instructions
    pub fn vm_cmp_eq(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_EQ, k)
    }
    pub fn vm_cmp_ge(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_GE, k)
    }
    pub fn vm_cmp_gt(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_GT, k)
    }
    pub fn vm_cmp_lt(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_LT, k)
    }
    pub fn vm_cmp_le(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_LE, k)
    }
    pub fn vm_cmp_ne(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_cmp(CMP_NE, k)
    }

    // construct VM_MY instructions
    pub fn vm_my_self(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_my(MY_SELF, k)
    }
    pub fn vm_my_beh(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_my(MY_BEH, k)
    }
    pub fn vm_my_state(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_my(MY_STATE, k)
    }

    // construct VM_END instructions
    pub fn vm_end_abort() -> Quad {
        Self::vm_end(END_ABORT)
    }
    pub fn vm_end_stop() -> Quad {
        Self::vm_end(END_STOP)
    }
    pub fn vm_end_commit() -> Quad {
        Self::vm_end(END_COMMIT)
    }

    // construct VM_SPONSOR instructions
    pub fn vm_sponsor_new(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_sponsor(SPONSOR_NEW, k)
    }
    pub fn vm_sponsor_memory(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_sponsor(SPONSOR_MEMORY, k)
    }
    pub fn vm_sponsor_events(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_sponsor(SPONSOR_EVENTS, k)
    }
    pub fn vm_sponsor_cycles(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_sponsor(SPONSOR_CYCLES, k)
    }
    pub fn vm_sponsor_reclaim(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_sponsor(SPONSOR_RECLAIM, k)
    }
    pub fn vm_sponsor_start(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_sponsor(SPONSOR_START, k)
    }
    pub fn vm_sponsor_stop(k: Any) -> Quad {
        assert!(k.is_ptr());
        Self::vm_sponsor(SPONSOR_STOP, k)
    }

    // construct detached Event
    pub fn new_event(sponsor: Any, target: Any, msg: Any) -> Quad {
        Self::event_t(sponsor, target, msg, NIL)
    }

    // construct detached Continuation
    pub fn new_cont(ip: Any, sp: Any, ep: Any) -> Quad {
        Self::cont_t(ip, sp, ep, NIL)
    }

    // construct idle Actor
    pub fn new_actor(beh: Any, state: Any) -> Quad {
        assert!(beh.is_ptr());
        Self::actor_t(beh, state, UNDEF)
    }

    // check for Forward Reference
    pub fn is_fwd_ref(&self) -> bool {
        (self.t() == FWD_REF_T) && (self.x() == UNDEF) && (self.y() == UNDEF) && !self.z().is_fix()
    }
}
