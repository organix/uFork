/*jslint browser */

import hex from "../../www/hex.js";
import parseq from "../../www/parseq.js";
import requestorize from "../../www/requestors/requestorize.js";
import thru from "../../www/requestors/thru.js";
import webrtc_transport from "../../www/transports/webrtc_transport.js";
import indexed_db from "./indexed_db.js";

const db_version = 4; // bump to clear DB

function db(...args) {
    return indexed_db(
        "peer_chat",
        db_version,
        function on_upgrade(db, old_version) {
            if (old_version < db_version) {
                db.createObjectStore("v" + db_version);
            }
        },
        "v" + db_version,
        ...args
    );
}

const signaller_origin = (
    location.protocol === "https:"
    ? "wss://"
    : "ws://"
) + location.host;
const transport = webrtc_transport();
const awp_store_key = "awp_store";

function set_store() {
    return thru(db(function (db_store, awp_store) {
        return db_store.put(awp_store, awp_store_key);
    }));
}

function get_store() {

// Attempts to read an AWP store object from IndexedDB. If one is not found, a
// new one is generated and saved.

// TODO guard against RTCCertificate expiry (1 year).

    return parseq.fallback([
        db(function (db_store) {
            return db_store.get(awp_store_key);
        }),
        parseq.sequence([
            transport.generate_identity(),
            requestorize(function (identity) {
                return {
                    identity,
                    bind_info: {
                        origin: signaller_origin,
                        password: "uFork"
                    },
                    acquaintances: [{
                        name: transport.identity_to_name(identity),
                        address: signaller_origin
                    }]
                };
            }),
            set_store()
        ])
    ]);
}

//debug get_store()(console.log);

export default Object.freeze({get_store, set_store});
