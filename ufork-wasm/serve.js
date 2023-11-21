// A Deno program that runs the development server.

// It requires permission to

//  a) bind to localhost (--allow-net=localhost)
//  b) read the files it serves from disk (--allow-read=.)

// For brevity, however, it should be safe to run it will full permissions like

//  $ deno run -A serve.js

/*jslint deno */

const cwd_href = import.meta.resolve("./");

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
    const mime_type = mime_types[request.url.split(".").pop()];
    if (typeof mime_type !== "string") {
        return new Response("Unsupported file extension.", {status: 400});
    }

// Any '..' path segments are discarded by this URL constructor, so we do not
// bother to guard against escapees.

    const file_path = new URL(request.url).pathname.slice(1);
    const file_url = new URL(file_path, cwd_href);
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

const listener = Deno.listen({
    hostname: "localhost",
    port: 7273
});
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
