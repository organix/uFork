// Base64 encoding and decoding for Deno and the browser.

//  encode(data)
//      The 'data' may be provided as a string, a Blob, an ArrayBuffer, or a
//      Uint8Array. The returned Promise resolves to a string.

//  decode(string)
//      Decodes the Base64 'string'. The returned Promise resolves to a
//      Uint8Array.

/*jslint browser, deno, global */

function encode_as_data_url(data, type) {

// The 'btoa' function provided by the browser does not support Unicode, so the
// only alternative, apart from reimplementing Base64 ourselves, is to abuse
// the FileReader.

    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
            return resolve(reader.result);
        };
        reader.onerror = function () {
            return reject(reader.error);
        };
        reader.readAsDataURL(new Blob([data], {type}));
    });
}

function encode(data) {
    return encode_as_data_url(data).then(function (data_url) {

// Discard the data URL's prefix, leaving only Base64.

        return data_url.split(";base64,")[1];
    });
}

function decode(string) {
    const data_url = "data:text/plain;base64," + string;
    return fetch(data_url).then(function (response) {
        return response.arrayBuffer();
    }).then(function (buffer) {
        return new Uint8Array(buffer);
    });
}

if (import.meta.main) {
    encode("hello 💸").then(decode).then(function (bytes) {
        globalThis.console.log(new TextDecoder().decode(bytes));
    });
}

export default Object.freeze({encode, decode});
