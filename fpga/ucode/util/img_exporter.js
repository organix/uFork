// @ts-check
/**
 * @use JSDoc
 * @overview This is a utility to translate masm.js output into .memh format
 *           suitable for verilog inclusion via $readmemh() directive or
 *           into wozmon hexdump format
 * @author Zarutian
 **/

import { makeArrayFromIterator } from "./util_funcs.js";

/**
  * @parameter {Map<Uint16, Uint16>} img - the ucode program memory image
  * @returns {Array<Uint16>} an array of uint16s
  **/
export const convert_img_to_array = (img) => {
    const entries = makeArrayFromIterator(img.entries());
    const result  = new Array(entries.length);
    entries.forEach(([addr, value]) => {
        result[addr] = value;
    });
    return result;
};

/**
  * @parameter {Map<Uint16, Uint16>} img - the ucode program memory image
  * @parameter {undefined | any} opts - options bag object
  * @returns {string} the .memh contents
  **/
export const convert_img_to_memh = (img, opts) => {
    const arr = convert_img_to_array(img);
    return String.prototype.concat.apply("// verilog memh format\n", arr.map(
        (item) => "".concat(Number(item).toString(16), "\n")
    ));
};

/**
  * @parameter {Map<Uint16, Uint16>} img - the ucode program memory image
  * @parameter {undefined | any} opts - options bag object
  * @returns {string} the wozmon hexdump
  **/
export const convert_img_to_wozmon_hex = (img, opts) => {
    const entries = makeArrayFromIterator(img.entries());
    // tbd: maybe sort entries based on address?
    return String.prototype.concat.apply("", entries.map(
        ([addr, value]) => "".concat(
            Number(addr).toString(16).toUppecase(),
            ": ",
            Number(value).toString(16).toUppercase(),
            "\n",
        )
    ));
    
};

export default Object.freeze({
    convert_img_to_array,
    convert_img_to_memh,
    convert_img_to_wozmon_hex,
});
