// @ts-check js
/**
 * @use JSDoc
 * @overview This tests the ../util/emulator.js
 * @author Zarutian
 */

const require = (module_specifier) => {
  if (Deno != undefined) {
    if (Deno.env.has("valtown")) {
      return import(module_specifier);
    }
  }
  if (String.prototype.startsWith.call(module_specifier, "npm:")) {
    return import("@".concat(String.prototype.slice(module_specifier, 4)));
  }
};

const { test } = await require("npm:ava");

// ava docu: https://github.com/avajs/ava/tree/2e0c2b1cef779e1c092eb60f0a9558bb9cf4c848/docs
/*
todo:
  1. write a test for every primitive instruction and for calls
  2. write a test to test memory
  3. write a test to test quad memory
  4. write a test to test a small ucode image
*/
/* template:
test("name of test", t => {
});
*/
// note this only works for uCode cpu version 2.2
const common_setup = async (opts) => {
  const {
    makeStack,
    makeMemory,
    makeQuadMemory,
    makeDebugIOStub,
    makeEmulator_uFork_SM2v2,
  } = await require("../util/emulator.js");

  const dstack = makeStack();
  const rstack = makeStack();
  const memory = makeMemory();
  const quads  = makeQuadMemory();
  const io     = makeDebugIOStub();
  const emu    = makeEmulator_uFork_SM2v2({
    quads,
    microcode_memory: memory, 
    dstack,
    rstack,
    debug_io: io, 
  });
  
  return {
    dstack, rstack, memory, quads, io, emu,
  };
}
test("uCode cpu 2v2 NOP instr", async t => {
  const { emu, memory } = await common_setup();
  emu.pc = 0x0000;
  memory.store(0x0000, 0x0000);
  emu.doOneInstruction();
  // todo: actually check if stuff that happened, did
  t.pass();
  return undefined;
});
test("uCode cpu 2v2 PLUS instr", async (t) => {
  const { emu, dstack, memory } = await common_setup();
  emu.pc = 0x0000;
  memory.store(0x0741, 0x0000);
  dstack.push(0x0001);
  dstack.push(0x0002);
  emu.doOneInstruction();
  const result = dstack.pop();
  if (result == 0x0003) {
    t.pass();
  } else {
    t.fail(`got ${result} but expected 0x0003`);
  }
});
test("uCode cpu 2v2 AND instr", async (t) => {
  const { emu, dstack, memory } = await common_setup();
  emu.pc = 0x0000;
  memory.store(0x0744, 0x0000);
  dstack.push(0x00FF);
  dstack.push(0x6942);
  emu.doOneInstruction();
  const result = dstack.pop();
  if (result == 0x0042) {
    t.pass();
  } else {
    t.fail(`expected 0x0042 but got 0x${result.toString(16).padStart(4, "0")}`);
  }
});
