/*jslint browser */

import hex from "../../www/hex.js";
import party from "./party.js";

function make_input(role) {
    const label = document.createElement("label");
    label.textContent = role;
    label.style.display = "block";
    label.style.marginBottom = "12px";
    const input = document.createElement("input");
    input.value = localStorage.getItem(role);
    label.append(input);
    document.body.append(label);
    return function () {
        localStorage.setItem(role, input.value);
        return input.value;
    };
}

const gm_name = make_input("Grant Matcher name: ");
const keqd_name = make_input("KEQD name: ");
const button = document.createElement("button");
button.textContent = "Start";
button.onclick = function () {
    party(
        import.meta.resolve("./donor.asm"),
        [hex.decode(gm_name()), hex.decode(keqd_name())]
    );
};
document.body.append(button);

