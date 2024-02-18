// @ts-check
/**
 * @overview This is the instruction level emulator for testing the microcode image
 * @author Zarutian
 */

export const makeStack = (opts) => {
  const contents = []; // FlexList

  return {
    getContents: () => contents.map((x) => x),
    push: (item) => { contents.push(item) },
    pop:  () => contents.pop(),
  };
};

export const makeMemory = (opts) => {
  const contents = new Map();
  return {
    getContents: () => contents,
    fetch: (addr) => {
      if (contents.has(addr)) {
        return contents.get(addr);
      } else {
        return 0x0000;
      }
    },
    store: (val, addr) => {
      if (val === 0x0000) {
        contents.delete(addr);
      } else {
        contents.set(addr, val);
      }
    },
  };
};

const incr = (val) => ((val + 1) & 0xFFFF);

export const makeEmulator = (opts) => {
  opts = (opts == undefined) ? {} : opts;
  const emu = {};
  const quads  = (opts.quad_memory == undefined) ? makeQuadMemory() : opts.quad_memory ;
  const memory = (opts.microcode_memory == undefined) ? makeMemory() : opts.microcode_memory ;
  let pc = (opts.pc == undefined) ? 0x0100 : opts.pc ;
  const dstack = makeStack();
  const rstack = makeStack();
  emu.doOneInstruction = () => {
    const instr = memory.get(pc);
    pc = incr(pc);
    switch (instr) {
      // UMPLUS
      case 0x0001: {
        const b = dstack.pop();
        const a = dstack.pop();
        const sc = a + b;
        dstack.push(sc & 0xFFFF); // sum
        dstack.push((sc >> 16) & 0xFFFF); // carry
      }; break;
      // AND
      case 0x0002: {
        const b = dstack.pop();
        const a = dstack.pop();
        dstack.push(a & b);
      }; break;
      // XOR
      case 0x0003: {
        const b = dstack.pop();
        const a = dstack.pop();
        dstack.push(a ^ b);
      }; break;
      // 1LBR
      case 0x0004: {
        const a = dstack.pop();
        dstack.push((a << 1) | ((a >> 15) & 1));
      }; break;
      // INCR
      case 0x0005:
        dstack.push(incr(dstack.pop()));
        break;
      // FETCH
      case 0x0006:
        dstack.push(memory.fetch(dstack.pop()));
        break;
      // STORE
      case 0x0007: {
        const addr = dstack.pop();
        const val  = dstack.pop();
        memory.store(val, addr);
      }; break;
      // DUP
      case 0x0008: {
        const a = dstack.pop();
        dstack.push(a);
        dstack.push(a);
      }; break;
      // DROP
      case 0x0009:
        dstack.pop();
        break;
      // SWAP
      case 0x000A: {
        const b = dstack.pop();
        const a = dstack.pop();
        dstack.push(b);
        dstack.push(a);
      }; break;
      // SKZ
      case 0x000B: {
        const cond = dstack.pop();
        if (cond === 0x0000) {
          pc = incr(pc);
        }
      }; break;
      // TO_R
      case 0x000C:
        rstack.push(dstack.pop());
        break;
      // R_FROM
      case 0x000D:
        dstack.push(rstack.pop());
        break;
      // EXT
      case 0x000E:
        throw new Error("ext instr is not implemented");
      // EXIT
      case 0x000F:
        pc = rstack.pop();
        break;
      // QUAD_T_FETCH
      // QUAD_X_FETCH
      // QUAD_Y_FETCH
      // QUAD_Z_FETCH
      case 0x0010: // gegnfall
      case 0x0011: // gegnfall
      case 0x0012: // gegnfall
      case 0x0013: {
        const addr = dstack.pop();
        const quad = quads.fetch(addr);
        const idx  = instr & 3;
        dstack.push(quad[idx]);
      }; break;
      // QUAD_T_STORE 0x0014);
      // QUAD_X_STORE 0x0015);
      // QUAD_Y_STORE 0x0016);
      // QUAD_Z_STORE 0x0017);
      case 0x0014: // gegnfall
      case 0x0015: // gegnfall
      case 0x0016: // gegnfall
      case 0x0017: {
        const addr = dstack.pop();
        const val  = dstack.pop();
        const quad = new Array(quads.fetch(addr));
        const idx  = instr & 3;
        quad[idx] = val;
        quads.store(quad, addr);
      }; break;
        
  def("QUAD_ALLOCATE", 0x0018);
  def("QUAD_FREE",    0x0019);
  def("QUAD_GCSTEP",  0x001A);

  def("DEBUG_LED",    0x003C);
  def("DEBUG_RX?",    0x003D);
  def("DEBUG_TX?",    0x003E);
  def("DEBUG_TX!",    0x003F);
    }
  }
  
  return emu;
};

export default {
  makeEmulator,
};
