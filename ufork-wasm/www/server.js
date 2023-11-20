// Runs the development server.

// It requires permission to bind to localhost, and to read the files it will
// serve.

/*jslint deno */

import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";

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
const cwd_url = new URL(toFileUrl(Deno.cwd()).href + "/");
const listener = Deno.listen({
    hostname: "localhost",
    port: 7273
});

function respond(request) {
    const mime_type = mime_types[request.url.split(".").pop()];
    if (typeof mime_type !== "string") {
        return new Response("Unsupported file extension.", {status: 400});
    }

// Any '..' path segments are discarded by the URL constructor, so we do not
// need to check for escapees.

    const file_path = new URL(request.url).pathname.slice(1);
    const file_url = new URL(file_path, cwd_url);
    return Deno.readFile(file_url).then(function (buffer) {
        return new Response(buffer, {
            status: 200,
            headers: {"content-type": mime_type}
        });
    }).catch(function (error) {
        window.console.error(error);
        return new Response("Not found.", {status: 404});
    });
}

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
window.console.log(
    "Navigate to http://localhost:" + listener.addr.port + "/www/index.html"
);
