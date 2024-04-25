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
    makeMemory,
    makeQuadMemory,
    makeDebugIOStub,
    makeEmulator_uFork_SM2v2,
  } = await require("../util/emulator.js");
}
test("uCode cpu 2v2 NOP instr", async t => {
});
