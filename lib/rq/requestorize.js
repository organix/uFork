// Turn any single parameter function into a requestor.

function requestorize(unary_function) {
    return function requestorize_requestor(callback, value) {
        try {
            return callback(unary_function(value));
        } catch (exception) {
            return callback(undefined, exception);
        }
    };
}

export default Object.freeze(requestorize);
