/*jslint browser, devel */

window.WebAssembly.instantiateStreaming(
    fetch("../target/wasm32-unknown-unknown/release/minimal_wasm.wasm"),
    {
        imports: {
            double(x) {
                return 2 * x;
            }
        }
    }
).then(function (wasm) {
    console.log(wasm.instance.exports.call_double(21));
    wasm.instance.exports.init();
    console.log(wasm.instance.exports.ip());
    console.log(wasm.instance.exports.step());
    console.log(wasm.instance.exports.ip());
    console.log(wasm.instance.exports.step());
    console.log(wasm.instance.exports.ip());
    console.log(wasm.instance.exports.fixnum(12));
});
