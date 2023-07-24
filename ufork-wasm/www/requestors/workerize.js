// A wrapper around a requestor that runs within a Web Worker.

// The 'requestor_url' parameter is a fully qualified URL string of a JavaScript
// module that exports a requestor factory.

// The remaining 'parameters' are passed to the factory.

/*jslint browser */

// The Worker expects a single message like {requestor_url, value, parameters}
// where "value" is the input value.

// When the requestor completes, it sends a message like {value, reason}.

const worker_src = `
    self.onmessage = function (message) {
        const {requestor_url, parameters, value} = message.data;
        import(requestor_url).then(function (module) {
            const requestor = module.default(...parameters);
            requestor(
                function callback(value, reason) {
                    return self.postMessage(
                        value === undefined
                        ? {reason}
                        : {value}
                    );
                },
                value
            );
        }).catch(function (reason) {
            self.postMessage({reason});
        });
    };
`;

function workerize(requestor_url, ...parameters) {
    return function workerize_requestor(callback, value) {
        try {
            const worker = new Worker(
                "data:application/javascript," + encodeURIComponent(worker_src),
                {type: "module"}
            );
            worker.postMessage({requestor_url, parameters, value});
            worker.onerror = function (error) {
                worker.terminate();
                return callback(undefined, error);
            };
            worker.onmessage = function (event) {
                worker.terminate();
                const result = event.data;
                return (
                    result?.value !== undefined
                    ? callback(result.value)
                    : callback(undefined, result.reason)
                );
            };
            return function cancel() {
                worker.terminate();
            };
        } catch (exception) {
            return callback(undefined, exception);
        }
    };
}

//debug const cancel = workerize(
//debug     import.meta.resolve("./thru.js")
//debug )(
//debug     console.log,
//debug     true
//debug );
//debug setTimeout(cancel, 500);

export default Object.freeze(workerize);
