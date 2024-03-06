// @ts-check js
/**
 * @use JSDoc
 * @overview Various small utility functions
 * @author Zarutian
 **/

export const makeArrayFromIterator = (iterator) => {
  const arr = [];
  let done = false;
  let value = undefined;
  while (!done) {
    ({ value, done }) = iterator.next();
    done = (done == undefined) ? false : done ;
    if (value != undefined) {
      arr.push(value);
    }
  }
  return arr;
};
