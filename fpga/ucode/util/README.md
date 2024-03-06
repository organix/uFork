
How to use the masm with the emulator:

```js
  import { makeAssembler } from "./masm.js";
  import { makeEmulator, makeMemory } from "./emulator.js";

  const assembly_top_module = (asm, opts = {}) => {
    const { def, dat, org } = asm;
    // big mix of calls to def, dat, and org
    return asm.done(); // done, we want to produce the image
  };
  const asm = makeAssembler();
  assembly_top_module(asm);
  const { image } = await asm.whenDone();
  const emu = makeEmulator({ memory: makeMemory(image), });
```
