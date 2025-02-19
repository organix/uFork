// Protect a function from being called more than once in a given interval of
// time.

/*jslint web, global */

function throttle(callback, interval) {
    let last_fired = Date.now() - interval;
    let timer;

    function fire(...args) {
        last_fired = Date.now();
        callback(...args);
    }

    return function (...args) {
        const elapsed = Date.now() - last_fired;
        clearTimeout(timer);
        if (elapsed >= interval) {
            fire(...args);
        } else {
            timer = setTimeout(fire, interval - elapsed, ...args);
        }
    };
}

if (import.meta.main) {
    const throttled = throttle(globalThis.console.log, 1000);
    const start = Date.now();
    const timer = setInterval(function () {
        throttled("fired", Date.now() - start);
    }, 50);
    setTimeout(clearInterval, 5000, timer);
}

export default Object.freeze(throttle);
