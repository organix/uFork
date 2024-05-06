
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

How to make an ucode image in verilog memh format:
```js
import {
  makeUcodeImage,
} from "../src/ucode_image_asm.js";

import { convert_img_to_memh } from "./img_exporter.js"

const imgp = makeUcodeImage({
  wozmon: {},
  uFork: {},
});
const img = await imgp;
const imgh = convert_img_to_memh(img.image);
console.log(imgh);
```

How to use verilog memh image with the emulator:
```js
  import { memh2img } from "./img_importer.js";
  import { makeEmulator, makeMemory } from "./emulator.js";

  const [image] = memh2img("<string of memh data>");
  const emu = makeEmulator({ memory: makeMemory(image), });
```

