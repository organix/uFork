// Describes an audit, that is, a non-fatal problem encountered by the core.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ufork from "../ufork.js";
import raw_ui from "./raw_ui.js";

const audit_ui = make_ui("audit-ui", function (element, {
    code,
    evidence,
    ram = new Uint8Array(),
    rom = new Uint8Array(),
    rom_debugs = Object.create(null)
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: block;
            font-family: ${theme.proportional_font_family};
        }
        h1 {
            margin: 0 0 12px;
        }
        dl {
            font-size: 13px;
            color: ${theme.white};
            display: grid;
            grid-template-columns: max-content 1fr;
            gap: 0.2em 0.4em;
            margin: 0;
        }
        dl > dt {
            text-align: right;
        }
        dl > dd {
            margin: 0;
        }
    `);
    const contents = dom("audit_text");
    contents.append(dom("h1", "Audit"));
    contents.append(dom("dl", [
        dom("dt", "code:"),
        dom("dd", ufork.fault_msg(code)),
        dom("dt", "evidence:"),
        dom("dd", [
            raw_ui({
                value: evidence,
                ram,
                rom,
                rom_debugs
            })
        ])
    ]));
    shadow.append(style, contents);
});

function demo() {
    document.documentElement.innerHTML = "";
    const element = audit_ui({
        code: ufork.E_NOT_CAP,
        evidence: ufork.UNDEF_RAW
    });
    document.head.append(dom("meta", {name: "color-scheme", content: "dark"}));
    document.body.append(element);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(audit_ui);
