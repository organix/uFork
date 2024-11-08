// ed.js
// James Diacono
// 2024-06-01

// A minimal code editor for the Web, with support for syntax highlighting,
// copy/paste, and undo/redo. Tested on Chrome, Safari, and Firefox.

// Public Domain.

/*jslint browser, global */

function find(node, callback) {
    let result = callback(node);
    if (result === undefined) {
        Array.from(node.childNodes).every(function (child_node) {
            result = find(child_node, callback);
            return result === undefined;
        });
    }
    return result;
}

function next(node) {
    while (!node.nextSibling && node.parentNode) {
        node = node.parentNode;
    }
    return node.nextSibling;
}

function is_text(node) {
    return node.nodeType === Node.TEXT_NODE;
}

function get_selection_range(element) {

// If a valid Selection lies within 'element', its Range is returned, otherwise
// undefined is returned.

    try {

// When the element is within a ShadowRoot, browser compatibility breaks down.
// See https://stackoverflow.com/a/70523247.

        const selection = (
            typeof element.getRootNode().getSelection === "function"
            ? element.getRootNode().getSelection() // Chrome
            : document.getSelection() // Firefox
        );
        const is_shadow = element.getRootNode() !== document;
        const range = (
            (is_shadow && typeof selection.getComposedRanges === "function")
            ? selection.getComposedRanges(element.getRootNode())[0] // Safari
            : selection.getRangeAt(0)
        );
        if (
            element.contains(range.startContainer)
            && element.contains(range.endContainer)
        ) {
            return range;
        }
    } catch (_) {}
}

function get_position(element, caret) {
    let [caret_node, caret_offset] = caret;
    if (!is_text(caret_node)) {
        caret_node = caret_node.childNodes[caret_offset] ?? next(caret_node);
        caret_offset = 0;
    }
    let position = 0;
    find(element, function (node) {
        if (node === caret_node) {
            position += caret_offset;
            return true;
        }
        if (is_text(node)) {
            position += node.textContent.length;
        }
    });
    return position;
}

function get_caret(element, position) {
    return (

// Find the text node encompassing the position.

        find(element, function (node) {
            if (is_text(node)) {
                if (position >= 0 && position <= node.textContent.length) {
                    return [node, position];
                }
                position -= node.textContent.length;
            }
        })

// If there were no text nodes, or the position was out of range, place the
// caret at the start of the element.

        ?? [element, 0]
    );
}

// document.body.innerHTML = `
//     <b>
//         B
//         <c> C </c>
//         <d>
//             D
//             <e> E </e>
//         </d>
//     </b>
//     <f> F </f>
//     <g>
//         G
//         <h> H </h>
//     </g>
// `.replace(/\s/g, "");
// const b = document.body.querySelector("b");
// console.log(get_position(document.body, [b, b.childNodes.length])); // </d>I
// console.log(get_position(document.body, [document.body, 1])); // I<f>
// const caret = get_caret(document.body, 4);
// console.log(caret.node.nodeValue, caret.offset);

function is_apple() {
    return (
        navigator.platform.startsWith("Mac")
        || navigator.platform === "iPhone"
        || navigator.platform === "iPad"
        || navigator.platform === "iPod"
    );
}

function is_command(keyboard_event) {
    return (
        is_apple()
        ? keyboard_event.metaKey
        : keyboard_event.ctrlKey
    );
}

function normalize_line_endings(text) {
    return text.replace(/\r\n?/g, "\n");
}

function ed({
    element,
    highlight,
    on_keydown,
    on_input
}) {
    const trailing_br = document.createElement("br");
    let history = [];
    let history_at = -1;
    let text_at_last_change;

    function get_text() {
        return element.textContent;
    }

    function set_text(text) {
        element.textContent = text;
        if (highlight !== undefined) {
            highlight(element);
        }
        element.append(trailing_br);
    }

    function get_cursor() {
        const range = get_selection_range(element);
        if (range === undefined) {
            return;
        }
        return [
            get_position(element, [range.startContainer, range.startOffset]),
            get_position(element, [range.endContainer, range.endOffset])
        ];
    }

    function set_cursor(cursor) {
        if (cursor !== undefined) {
            const [startContainer, startOffset] = get_caret(element, cursor[0]);
            const [endContainer, endOffset] = get_caret(element, cursor[1]);
            document.getSelection().setBaseAndExtent(
                startContainer,
                startOffset,
                endContainer,
                endOffset
            );
        }
    }

    function insert_text(text) {
        const cursor = get_cursor();
        const start = Math.min(...cursor);
        const end = Math.max(...cursor);
        set_text(
            get_text().slice(0, start)
            + text
            + get_text().slice(end)
        );
        set_cursor([start + text.length, start + text.length]);
    }

    function maybe_text_changed() {
        if (on_input !== undefined) {
            const text = get_text();
            if (text !== text_at_last_change) {
                text_at_last_change = text;
                on_input(text);
            }
        }
    }

    function record_history() {
        const text = get_text();
        const cursor = get_cursor();
        let at_record = history[history_at];
        if (text === at_record?.text) {
            at_record.cursor = cursor;
        } else {
            const record = {text, cursor};
            history_at += 1;
            history.length = history_at; // truncate
            history.push(record);
        }
    }

    function travel_history(direction) {
        const record = history[history_at + direction];
        if (record !== undefined) {
            set_text(record.text);
            set_cursor(record.cursor);
            history_at += direction;
        }
    }

    function keydown(event) {
        record_history();
        if (is_command(event) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            travel_history(
                event.shiftKey
                ? 1
                : -1
            );
        }
        if (on_keydown !== undefined) {
            on_keydown(event);
        }
        if (!event.defaultPrevented && event.key === "Enter") {

// Browsers insert a <br> on Enter, but we just want a newline character.

            event.preventDefault();
            insert_text("\n");
        }
        maybe_text_changed();
    }

    function input(event) {
        if (!event.isComposing) {
            maybe_text_changed();
            if (highlight !== undefined) {
                const cursor = get_cursor();
                trailing_br.remove();
                highlight(element);
                element.append(trailing_br);
                set_cursor(cursor);
            }

// A contenteditable element does not render its trailing newline, if it has
// one. This frustrates the user by rejecting their cursor from the last line.
// Our crude workaround is to maintain a trailing <br>, invisible to
// element.textContent.

            element.append(trailing_br);
        }
    }

    function paste(event) {

// Pasting almost works fine without intervention, except that leading newlines
// are lost.

        event.preventDefault();
        insert_text(normalize_line_endings(
            event.clipboardData.getData("text/plain")
        ));
        maybe_text_changed();
    }

    function selectionchange() {

// If the selection extends beyond the trailing <br>, pressing Backspace appears
// to do nothing because the <br> is added back immediately. Our workaround is
// to exclude the trailing <br> from the selection.

        const range = get_selection_range(element);
        if (range !== undefined) {
            const end = element.childNodes.length;
            if (
                (range.startContainer === element && range.startOffset === end)
                || (range.endContainer === element && range.endOffset === end)
            ) {
                set_cursor(get_cursor());
            }
        }
    }

    function destroy() {
        element.removeEventListener("keydown", keydown);
        element.removeEventListener("input", input);
        element.removeEventListener("paste", paste);
        element.removeEventListener("cut", record_history);
        document.removeEventListener("selectionchange", selectionchange);
    }

    element.addEventListener("keydown", keydown);
    element.addEventListener("input", input);
    element.addEventListener("paste", paste);
    element.addEventListener("cut", record_history);
    document.addEventListener("selectionchange", selectionchange);
    element.contentEditable = "true";
    element.spellcheck = false;
    text_at_last_change = get_text();
    if (highlight !== undefined) {
        highlight(element);
    }
    element.append(trailing_br);
    return {
        get_text,
        set_text,
        insert_text,
        get_cursor,
        set_cursor,
        record_history,
        travel_history,
        is_command,
        destroy
    };
}

const caret_anchor = "▶";
const caret_focus = "◀";
const colors = ["red", "purple", "orange", "green", "blue"];

function alter_string(string, alterations) {
    alterations = alterations.slice().sort(
        function compare(a, b) {
            return a.range[0] - b.range[0] || a.range[1] - b.range[1];
        }
    );
    let end = 0;
    return alterations.map(
        function ({range, replacement}) {
            const chunk = string.slice(end, range[0]) + replacement;
            end = range[1];
            return chunk;
        }
    ).concat(
        string.slice(end)
    ).join(
        ""
    );
}

function visualize_selection_range(node, range) {
    let string = "";
    let indent = "";

    function caret(node, caret, selection_node, selection_offset) {
        return (
            (
                node.parentNode === selection_node
                && Array.from(
                    node.parentNode.childNodes
                ).indexOf(
                    node
                ) === selection_offset
            )
            ? caret
            : ""
        );
    }

    function carets(node, offset_offset) {
        return caret(
            node,
            caret_anchor,
            range?.startContainer,
            range?.startOffset + offset_offset
        ) + caret(
            node,
            caret_focus,
            range?.endContainer,
            range?.endOffset + offset_offset
        );
    }

    function append_text(node) {
        let alterations = [];
        if (range?.startContainer === node) {
            alterations.push({
                range: [range.startOffset, range.startOffset],
                replacement: caret_anchor
            });
        }
        if (range?.endContainer === node) {
            alterations.push({
                range: [range.endOffset, range.endOffset],
                replacement: caret_focus
            });
        }
        const text = alter_string(node.textContent, alterations);
        const pre = carets(node, 0);
        const post = (
            node.nextSibling
            ? ""
            : carets(node, -1)
        );
        string += indent + pre + JSON.stringify(text) + post + "\n";
    }

    function append_element(node) {
        const children = Array.from(node.childNodes);
        const tag = node.tagName.toLowerCase();
        const pre = carets(node, 0);
        const post = (
            node.nextSibling
            ? ""
            : carets(node, -1)
        );
        if (children.length === 0) {
            string += indent + pre + "<" + tag + " />" + post + "\n";
        } else {
            string += indent + pre + "<" + tag + ">" + post + "\n";
            indent += "    ";
            children.forEach(append_node);
            indent = indent.slice(4);
            string += indent + "</" + tag + ">\n";
        }
    }

    function append_node(node) {
        return (
            node.nodeType === Node.ELEMENT_NODE
            ? append_element(node)
            : append_text(node)
        );
    }

    append_node(node);
    return string;
}

function highlight(element) {
    let text = element.textContent;
    element.innerHTML = "";
    const rx_token = /(\w+)|(\s+)|(.)/g;
    while (true) {
        const matches = rx_token.exec(text);
        if (!matches) {
            break;
        }
        const word = matches[1];
        const space = matches[2];
        const other = matches[3];
        if (word !== undefined || other !== undefined) {
            const span = document.createElement("span");
            span.style.color = colors[
                rx_token.lastIndex % colors.length
            ];
            span.textContent = word ?? other;
            element.append(span);
        } else if (space !== undefined) {
            element.append(space);
        }
    }
}

if (import.meta.main) {
    document.documentElement.innerHTML = "<body></body>\n"; // Firefox v122
    const source = document.createElement("div"); // Firefox v122
    source.style.flex = "1 1 50%";
    source.style.whiteSpace = "pre";
    source.style.caretColor = "black";
    source.style.fontFamily = "monospace";
    source.style.outline = "none";
    source.style.padding = "0 5px";
    //source.textContent = "abc\r\ndef\rstuff\nthings";
    source.textContent = "abc\ndef\nstuff\nthings";
    const preview = document.createElement("html_preview");
    preview.style.flex = "1 1 50%";
    preview.style.whiteSpace = "pre";
    preview.style.fontFamily = "monospace";
    document.documentElement.style.height = "100%";
    document.body.style.margin = "0px";
    document.body.style.height = "100%";
    document.body.style.display = "flex";
    globalThis.console.log("Rendering in ShadowRoot");
    const shadow = document.body.attachShadow({mode: "closed"});
    shadow.append(source, preview);
    //console.log("Rendering in document");
    //document.body.append(source, preview);
    const editor = ed({
        element: source,
        highlight,
        on_keydown(event) {
            if (event.key === "Tab") {
                event.preventDefault();
                editor.insert_text("    ");
            }
        },
        on_input(text) {
            globalThis.console.log(JSON.stringify(text));
        }
    });
    const refresh_preview = function () {
        preview.textContent = (
            "HTML\n"
            + visualize_selection_range(source, get_selection_range(source))
            + "\nTEXT\n"
            + JSON.stringify(source.textContent)
        );
    };
    globalThis.oninput = refresh_preview;
    document.onselectionchange = refresh_preview;
    refresh_preview();
}

export default Object.freeze(ed);
