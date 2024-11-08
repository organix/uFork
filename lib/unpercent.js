// The URL object percent-encodes all special characters in the query string,
// making embedded URLs much harder to read. The 'unpercent' function decodes
// just the query portion of a URL, except for "?", "&", "=", and "#"
// characters.

/*jslint global */

function unpercent(url) {
    const rx_percent_encoded = /%[0-7][0-9A-F]/g;
    const [base, query] = String(url).split("?");
    if (query === undefined) {
        return base;
    }
    const structural = ["?", "&", "=", "#"];
    return base + "?" + query.replace(rx_percent_encoded, function (encoded) {
        const decoded = decodeURIComponent(encoded);
        return (
            structural.includes(decoded)
            ? encoded
            : decoded
        );
    });
}

if (import.meta.main) {
    globalThis.console.log(unpercent("http://a.b/c?d=http%3A%2F%2Fe.f%3Fg#h"));
}

export default Object.freeze(unpercent);
