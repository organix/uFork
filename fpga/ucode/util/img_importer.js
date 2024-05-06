// @ts-check js
/**
 * @use JSDoc
 * @overview This file provides functions to import ucode memory images from
 *           various formats.
 * @author Zarutian
 */

// @param {string} memh text string
// @returns {[Map<number, number>, undefined]}
export const memh2img = (inp) => {
  // this version only gives the image and not symbols
  const t1 = inp.split("\n"); // split into lines
  const t2 = t2.map((line) => line.slice(0, line.indexOf("//"))); // get rid of comments
  const t3 = t3.filter((line) => (line != "")); // get rid of empty lines
  // merkill
};
export default {
  memh2img,
};
