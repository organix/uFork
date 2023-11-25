// A Deno web server that hosts the debugger, for local development.

// It requires permission to

//  a) bind to localhost (--allow-net=localhost)
//  b) read the files it serves from disk (--allow-read=.)

/*jslint deno */

import import_map from "../../tools/import_map.js";
const cwd_href = import.meta.resolve("./");

const rx_ufork_lib = /https:\/\/lib\.ufork\.org\//g;
const mime_types = {
    html: "text/html",
    png: "image/png",
    svg: "image/svg+xml",
    js: "text/javascript",
    wasm: "application/wasm",
    json: "application/json",
    scm: "text/plain",
    asm: "text/plain"
};

function respond(request) {

// Any '..' path segments are discarded by this URL constructor, so we do not
// bother to guard against escapees.

    let file_path = new URL(request.url).pathname.slice(1);
    let file_url;
    if (file_path.startsWith("@/")) {

// Consult the import map.

        file_path = file_path.slice(2);
        const alias = Object.keys(import_map).find(function (key) {
            return file_path.startsWith(key);
        });
        file_url = new URL(file_path.replace(alias, import_map[alias]));
    } else {
        file_url = new URL(file_path || "index.html", cwd_href);
    }
    const mime_type = mime_types[file_url.pathname.split(".").pop()];
    if (typeof mime_type !== "string") {
        return new Response("Unsupported file extension.", {status: 400});
    }
    return Deno.readFile(file_url).then(function (buffer) {
        return new Response(
            (

// Modify the import map to point back to this server, so that source files are
// loaded from the local repository.

                file_url.pathname.endsWith("index.html")
                ? new TextDecoder().decode(buffer).replace(rx_ufork_lib, "/@/")
                : buffer
            ),
            {headers: {"content-type": mime_type}}
        );
    }).catch(function (error) {
        window.console.error(error);
        return new Response("Not found.", {status: 404});
    });
}

const listener = Deno.listen({hostname: "localhost", port: 7273});
listener.accept().then(function on_connection(tcp) {
    const http = Deno.serveHttp(tcp);
    http.nextRequest().then(function on_request(event) {
        if (event) {
            event.respondWith(respond(event.request));
            http.nextRequest().then(on_request);
        }
    });
    listener.accept().then(on_connection);
});
window.console.log("Navigate to http://localhost:" + listener.addr.port);
