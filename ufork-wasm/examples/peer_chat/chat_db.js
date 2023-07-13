/*jslint browser, devel */

import hex from "../../www/hex.js";
import parseq from "../../www/parseq.js";
import requestorize from "../../www/requestors/requestorize.js";
import thru from "../../www/requestors/thru.js";
import webrtc_transport from "../../www/transports/webrtc_transport.js";
import indexed_db from "./indexed_db.js";

function db(...args) {
    return indexed_db(
        "peer_chat",
        2,
        function on_upgrade(db, old_version) {
            if (old_version < 2) {
                db.createObjectStore("items");
            }
        },
        "items",
        ...args
    );
}

const signaller_origin = (
    location.protocol === "https:"
    ? "wss://"
    : "ws://"
) + location.host;

function make_address(name) {
    return signaller_origin + "/connect?name=" + hex.encode(name);
}

function make_bind_info(name) {
    return (
        signaller_origin
        + "/listen?name=" + hex.encode(name)
        + "&password=uFork"
    );
}

const transport = webrtc_transport();
const awp_store_key = "awp_store";

function set_store() {
    return thru(db(function (store, awp_store) {
        return store.put(awp_store, awp_store_key);
    }));
}

function get_store() {

// Attempts to read an AWP store object from IndexedDB. If one is not found, a
// new one is generated and saved.

// TODO guard against RTCCertificate expiry.

    return parseq.fallback([
        db(function (store) {
            return store.get(awp_store_key);
        }),
        parseq.sequence([
            transport.generate_identity(),
            requestorize(function (identity) {
                const name = transport.identity_to_name(identity);
                const address = make_address(name);
                return {
                    identity,
                    bind_info: make_bind_info(name),
                    acquaintances: [{name, address}]
                };
            }),
            set_store()
        ])
    ]);
}

//debug get_store()(console.log);

export default Object.freeze({get_store, set_store});
