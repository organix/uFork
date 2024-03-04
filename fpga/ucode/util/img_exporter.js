// @ts-check
/**
 * @use JSDoc
 * @overview This is a utility to translate masm.js output into .memh format
 *           suitable for verilog inclusion via $readmemh() directive or
 *           into wozmon hexdump format
 * @author Zarutian
 **/

/**
  * @parameter {Map<Uint16, Uint16>} img - the ucode program memory image
  * @returns {Array<Uint16>} an array of uint16s
  **/
const convert_img_to_array = (img) => {
    const entries = new Array(img.entries());
    const result  = new Array(entries.length);
    entries.forEach(([addr, value]) => {
        result[addr] = value;
    });
    return result;
};

/**
  * @parameter {Map<Uint16, Uint16>} img - the ucode program memory image
  * @parameter {undefined | any} opts - options bag object
  * @returns {null | string} the .memh contents unless opts.write is present
  **/
const convert_img_to_memh = (img, opts) => {
    
};

/**
  * @parameter {Map<Uint16, Uint16>} img - the ucode program memory image
  * @parameter {undefined | any} opts - options bag object
  * @returns {null | string} the wozmon hexdump unless opts.write is present
  **/
const convert_img_to_wozmon_hex = (img, opts) => {

};

export default Object.freeze({
    convert_img_to_array,
    convert_img_to_memh,
    convert_img_to_wozmon_hex,
});
