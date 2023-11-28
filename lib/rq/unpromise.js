// Turns a Promise factory into a requestor. If the Promise resolves to
// undefined, the requestor produces 'undefined_value' instead of failing.

/*jslint browser, node */

function unpromise(make_promise, undefined_value) {
    return function unpromise_requestor(callback, value) {
        try {
            return make_promise(value).then(
                function on_success(result) {
                    return callback(result ?? undefined_value);
                },
                function on_fail(error) {
                    return callback(undefined, error);
                }
            );
        } catch (exception) {
            return callback(undefined, exception);
        }
    };
}

export default Object.freeze(unpromise);
