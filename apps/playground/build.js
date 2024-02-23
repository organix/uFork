// Builds a version of the playground optimized for size. This is strictly
// optional, because the source can be hosted as-is, but this version loads
// almost an order of magnitude faster.

// All the JavaScript is bundled into a single file and minified, reducing
// network latency.

// The source is included in a sourcemap file, loaded only when the user opens
// their browser's devtools.

/*jslint deno */

import {build} from "https://deno.land/x/esbuild@v0.20.1/mod.js";
import {fromFileUrl} from "https://deno.land/std@0.203.0/path/from_file_url.ts";
import {join} from "https://deno.land/std@0.203.0/path/join.ts";
const lib_path = fromFileUrl(import.meta.resolve("../../lib/"));
const js_path = fromFileUrl(import.meta.resolve("../../vm/js/"));
const src_path = fromFileUrl(import.meta.resolve("./"));

// ESBuild does not yet support import maps (see import_map.js), so we resolve
// the https://ufork.org imports to the local filesystem manually.

const rx_lib = /^https:\/\/ufork.org\//;
const import_map_plugin = {
    name: "import_map",
    setup(build) {
        build.onResolve(
            {filter: rx_lib},
            function ({path, kind, resolveDir}) {
                return build.resolve(
                    path.replace(
                        "https://ufork.org/lib/",
                        lib_path
                    ).replace(
                        "https://ufork.org/js/",
                        js_path
                    ),
                    {kind, resolveDir}
                );
            }
        );
    }
};

build({
    entryPoints: [join(src_path, "main.js")],
    format: "esm",
    minify: true,
    bundle: true,
    sourcemap: true,
    plugins: [import_map_plugin],
    outfile: join(src_path, "dist", "main.js")
}).then(function () {
    return Promise.all([
        Deno.copyFile(
            join(src_path, "index.html"),
            join(src_path, "dist", "index.html")
        ),
        Deno.copyFile(
            join(src_path, "programma.woff2"),
            join(src_path, "dist", "programma.woff2")
        ),
        Deno.copyFile(
            join(src_path, "favicon.png"),
            join(src_path, "dist", "favicon.png")
        )
    ]);
});
