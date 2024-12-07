// Binds the initial value of a requestor to the specified value.

function bind(requestor, value) {
    return function bind_requestor(callback) {
        return requestor(callback, value);
    };
}

export default Object.freeze(bind);
