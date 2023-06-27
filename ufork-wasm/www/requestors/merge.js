// A requestor that merges its output value (an object) with its input value
// (an object or undefined).

// The factory takes either a requestor that produces an object, or an object of
// requestors to run in parallel.

import parseq from "../parseq.js";
import pair from "./pair.js";
import requestorize from "./requestorize.js";

function merge(requestor_or_object) {
    return parseq.sequence([
        pair(
            typeof requestor_or_object === "function"
            ? requestor_or_object
            : parseq.parallel_object(requestor_or_object)
        ),
        requestorize(function ([output, input]) {
            return Object.assign({}, input, output);
        })
    ]);
}

export default Object.freeze(merge);
