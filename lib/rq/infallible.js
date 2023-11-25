// Makes an infallible requestor. It will produce an object like {value} on
// success, or {reason} on failure.

function infallible(requestor) {
    return function infallible_requestor(callback, initial_value) {
        try {
            return requestor(
                function (value, reason) {
                    return (
                        value !== undefined
                        ? callback({value})
                        : callback({reason})
                    );
                },
                initial_value
            );
        } catch (exception) {
            return callback({reason: exception});
        }
    };
}

export default Object.freeze(infallible);
