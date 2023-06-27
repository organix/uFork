// A requestor that behaves exactly like 'requestor' except that it produces its
// input value upon success. If 'requestor' is undefined, the input value is
// produced immediately.

function thru(requestor) {
    return function thru_requestor(callback, value) {
        try {
            if (requestor === undefined) {
                return callback(value);
            }
            return requestor(
                function (result, reason) {
                    return (
                        result === undefined
                        ? callback(undefined, reason)
                        : callback(value)
                    );
                },
                value
            );
        } catch (exception) {
            return callback(undefined, exception);
        }
    };
}
export default Object.freeze(thru);
