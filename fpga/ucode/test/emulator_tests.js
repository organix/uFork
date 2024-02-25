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

const { test } = require("npm:ava");

// ava docu: https://github.com/avajs/ava/tree/2e0c2b1cef779e1c092eb60f0a9558bb9cf4c848/docs
/*
todo:
  1. write a test for every primitive instruction and for calls
  2. write a test to test memory
  3. write a test to test quad memory
  4. write a test to test a small ucode image
*/
test("name of test", t => {
});
