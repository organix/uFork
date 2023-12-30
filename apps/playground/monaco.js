/*jslint browser, long */

import {editor, languages} from "monaco";
import make_editor_worker from "monaco_editor_worker";
import make_uforkasm_token_provider from "./monarch_uforkasm.js";

window.MonacoEnvironment = {
    getWorker() {
        return make_editor_worker();
    }
};
languages.register({id: "uforkasm", extensions: ["asm"]});
languages.setLanguageConfiguration("uforkasm", {comments: {lineComment: ";"}});
languages.setMonarchTokensProvider("uforkasm", make_uforkasm_token_provider());

function fetch_source() {
    const src = new URL(location.href).searchParams.get("src");
    return (
        src
        ? fetch(src).then(function (response) {
            return (
                response.ok
                ? response.text()
                : Promise.reject(new Error(response.status))
            );
        })
        : Promise.resolve("; Write some uFork assembly here...")
    );
}

fetch_source().then(function (source) {
    editor.create(document.getElementById("editor"), {
        value: source,
        language: "uforkasm",
        minimap: {enabled: false},
        theme: "vs-dark"
    });
}).catch(function (error) {
    document.body.append("Failed to load source: " + error.message);
});
