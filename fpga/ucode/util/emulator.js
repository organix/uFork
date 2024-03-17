// @ts-check
/**
 * @overview This is the instruction level emulator for testing the microcode image
 * @author Zarutian
 */

export const makeStack = (opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const contents = (opts.contents == undefined) ? [] : new Array(opts.contents);
  return {
    getContents: () => contents.map((x) => x),
    push: (item) => { contents.push(item) },
    pop:  () => contents.pop(),
  };
};

export const makeStackStatistican = (opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const report = (opts.report == undefined) ? {} : opts.report ;
  report.maxDepth  = (report.maxDepth == undefined ) ? 0 : report.maxDepth ;
  report.currDepth = (report.currDepth == undefined ) ? 0 : report.currDepth ;
  const stack = makeStack(opts.stackOpts);
  return {
    getContents: stack.getContents,
    push: (item) => {
      report.currDepth += 1;
      report.maxDepth = Math.max(report.currDepth, report.maxDepth);
      stack.push(item);
    },
    pop: () => {
      report.currDepth -= 1;
      return stack.pop();
    },
  };
};

export const makeMemory = (opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const contents = (opts.contents == undefined) ? new Map() : opts.contents ;
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

export const makeQuadMemory = (opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const contents = (opts.contents == undefined) ? new Map() : opts.contents;
  return {
    fetch: (addr) => {
      if (!contents.has(addr)) {
        contents.set(addr, [0x0000, 0x0000, 0x0000, 0x0000]);
      }
      return contents.get(addr);
    },
    store: (val, addr) => {
      contents.set(addr, val);
    },
    allot: () => {
      throw new Error("not yet implemented");
    },
    free: (addr) => {
      throw new Error("not yet implemented");
    },
    gcstep: () => {
      throw new Error("not yet implemented");
    },
  };
};

export const makeQuadMemoryWASMbridge = (opts) => {
  const {
    u_read_quad,
    u_write_quad,
    memory_descriptor_addr = 0x40000000,
    h_gc_run,
  } = opts;
  const iface = {
    fetch: (addr) => {
      const { t, x, y, z } = u_read_quad(addr);
      return [t, x, y, z];
    },
    store: (val, addr) => {
      const [t, x, y, z] = val;
      u_write_quad(addr, { t, x, y, z });
      return;
    },
    allot: () => {
      // selfnote: virðist eigi vera bein meðóða í wasm útgáfunni
      //           þannig að þetta mix er því notað.
      let [t, x, y, z] = iface.fetch(memory_descriptor_addr);
      let attempts = 4200;
      while((attempts > 0) || x == 0x0000) {
        iface.gcstep();
        [t, x, y, z] = iface.fetch(memory_descriptor_addr);
      }
      const addr = x;
      const [_, _, _, nextFree] = iface.fetch(addr);
      iface.store([t, nextFree, (y - 1)&0xFFFF, z], memory_descriptor_addr);
      iface.store([0, 0, 0, 0], addr);
      return addr;
    },
    free: (addr) => {
      // selfnote: það sama á við hér
      let [t, x, y, z] = iface.fetch(memory_descriptor_addr);
      iface.store([0xF, 0, 0, x], addr);
      iface.store([t, addr, (y + 1)&0xFFFF, z], memory_descriptor_addr);
      returnb
    },
    gcstep: () => {
      h_gc_run();
    },
  };
};

export const makeDebugIOStub = (opts) => {
  return {
    setLED: (colour) => {
      console.log(`µcode led: 0b${colour.toString(2)}`);
    },
    rx_ready: () => false,
    rx: () => 0,
    tx_ready: () => true,
    tx: (char) => {
      console.log(`µcode debug tx: "${String.fromCharCode(char)}"`);
    },
  };
};

const incr = (val) => ((val + 1) & 0xFFFF);

export const makeEmulator_uFork_CSM1 = (opts) => {
  opts = (opts == undefined) ? {} : opts;
  let pc = (opts.pc == undefined) ? 0x0040 : opts.pc ;
  const emu = {
    get pc() { return pc; },
    set pc(addr) { pc = addr; return addr; },
  };
  const quads  = (opts.quad_memory == undefined) ? makeQuadMemory() : opts.quad_memory ;
  const debug_io = (opts.debug_io == undefined) ? makeDebugIOStub() : opts.debug_io ;
  const memory = (opts.microcode_memory == undefined) ? makeMemory() : opts.microcode_memory ;
  const dstack = makeStack();
  const rstack = makeStack();
  emu.doOneInstruction = () => {
    const instr = memory.get(pc);
    pc = incr(pc);
    switch (instr) {
      // PLUS
      case 0x0001: {
        const b = dstack.pop();
        const a = dstack.pop();
        const sc = a + b;
        dstack.push(sc & 0xFFFF); // sum
        // dstack.push((sc >> 16) & 0xFFFF); // carry
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
      // QUAD_ALLOCATE
      case 0x0018: {
        const addr = quads.allot();
        dstack.push(addr);
      }; break;
      // QUAD_FREE
      case 0x0019: {
        const addr = dstack.pop();
        quads.free(addr);
      }; break;
      // QUAD_GCSTEP
      case 0x001A: {
        quads.gcstep();
      }; break;
      case 0x001B:
      case 0x001C:
      case 0x001D:
      case 0x001E:
      case 0x001F:
      case 0x0020:
      case 0x0021:
      case 0x0022:
      case 0x0023:
      case 0x0024:
      case 0x0025:
      case 0x0026:
      case 0x0027:
      case 0x0028:
      case 0x0029:
      case 0x002A:
      case 0x002B:
      case 0x002C:
      case 0x002D:
      case 0x002E:
      case 0x002F:
      case 0x0030:
      case 0x0031:
      case 0x0032:
      case 0x0033:
      case 0x0034:
      case 0x0035:
      case 0x0036:
      case 0x0037:
      case 0x0038:
      case 0x0039:
      case 0x003A:
        throw new Error("instruction reserved and not (yet) implemented");
      // DEBUG_LED
      case 0x003B: {
        const colours = dstack.pop();
        debug_io.setLED(colours);
      }; break;
      // DEBUG_Rx?
      case 0x003C: {
        let gotChar = debug_io.rx_ready();
        gotChar = gotChar ? 0xFFFF : 0x0000 ;
        dstack.push(gotChar);
      }; break;
      // DEBUG_RX@
      case 0x003D: {
        dstack.push(debug_io.rx());
      }; break;
      // DEBUG_TX?
      case 0x003E: {
        let ready = debug_io.tx_ready();
        ready = ready ? 0xFFFF : 0x0000 ;
        dstack.push(ready);
      }; break;
      // DEBUG_TX!
      case 0x003F: {
        const char = dstack.pop();
        debug_io.tx(char);
      }; break;
      // call
      default: {
        rstack.push(pc);
        pc = instr;
      }; break;
    }
  }
  
  return emu;
};

export const makeEmulator_uFork_SM2 = (opts) => {
  opts = (opts == undefined) ? {} : opts;
  let pc = (opts.pc == undefined) ? 0x0040 : opts.pc ;
  const emu = {
    get pc() { return pc; },
    set pc(addr) { pc = addr; return addr; },
  };
  const quads  = (opts.quad_memory == undefined) ? makeQuadMemory() : opts.quad_memory ;
  const debug_io = (opts.debug_io == undefined) ? makeDebugIOStub() : opts.debug_io ;
  const memory = (opts.microcode_memory == undefined) ? makeMemory() : opts.microcode_memory ;
  const dstack = makeStack();
  const rstack = makeStack();
  emu.doOneInstruction = () => {
    const instr = memory.get(pc);
    pc = incr(pc);
    const instr_15bit = (instr & 0x8000) >> 15;
    if (instr_15bit) {
      // Control
      const instr_addr = instr & 0x0FFF;
      const instr_PCR = (instr & 0x4000) >> 14;
      if (instr_PCR) {
        // PC+1 -> R
        rstack.push(pc);
      }
      const instr_tst_inc = (instr & 0x3000) >> 12;
      const instr_incdec  = (instr & 0x1000) >> 12;
      const instr_tst     = (instr & 0x2000) >> 12;
      switch (instr_tst_inc) {
        case 0b00: // addr -> PC
          pc = instr_addr;
          break;
        case 0b01: // (D0 == 0) ? addr->PC,DROP : PC+1->PC,D0+1->D0   gegnfall
        case 0b10: // (D0 == 0) ? addr->PC,DROP : PC+1->PC,DROP       gegnfall
        case 0b11: // (D0 == 0) ? addr->PC,DROP : PC+1->PC,D0-1->D0
          let TOS = dstack.pop();
          if (TOS == 0x0000) {
            pc = instr_addr;
          } else {
            pc = incr(pc);
            if (instr_incdec) {
              if (instr_tst) {
                TOS = decr(TOS);
              } else {
                TOS = incr(TOS);
              }
              dstack.push(TOS);
            }
          }
          break;
      }
    } else {
      // Evaluate
    }
  };
  return emu;
};
