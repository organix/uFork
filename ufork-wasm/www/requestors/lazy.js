// A requestor factory that delays the creation of a requestor until its input
// value is known. This can be useful when the arguments passed to
// the 'requestor_factory' are not known ahead of time.

// The requestor returned by the 'requestor_factory' is called with the
// 'initial_value' parameter.

function lazy(requestor_factory, initial_value) {
    return function lazy_requestor(callback, value) {
        try {
            return requestor_factory(value)(callback, initial_value);
        } catch (exception) {
            return callback(undefined, exception);
        }
    };
}

export default Object.freeze(lazy);
