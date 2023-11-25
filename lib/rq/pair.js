// A requestor that behaves just like 'requestor', except that its output value
// is paired with the original input value, producing an array like
// [output, input]. It can be used to preserve the input value of a requestor
// for later use.

import parseq from "../parseq.js";
import thru from "./thru.js";

function pair(requestor) {
    return parseq.parallel([requestor, thru()]);
}

export default Object.freeze(pair);
