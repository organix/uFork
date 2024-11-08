// ed.js
// James Diacono
// 2024-08-02

// A code editor for the Web, with support for syntax highlighting, copy/paste,
// undo/redo, and versioning. Tested on Chrome, Safari, and Firefox.

// Public Domain.

// GLOSSARY OF TERMS

// A "position" is an integer locating a character within a string. It is
// measured in string characters, not Unicode code points.

// A "cursor' identifies a selection of characters in a string, including the
// direction of the selection. It is an array like [anchor, focus], where
// 'anchor' and 'focus' are positions. A cursor is "collapsed" when the anchor
// and the focus are identical.

// A "range" is like a cursor, but can not have a backwards direction. Not be
// confused with window.Range.

// An "alteration" represents an change to a range of characters in
// a string. It is an object with these properties:

//      range
//          The range of characters to remove.
//      replacement
//          The string to insert.

// A "hunk" is a reversible alteration. It is an object with these properties:

//      remove
//          The text to be removed, as a string.
//      insert
//          The text to be inserted, as a string.
//      position
//          The starting position of 'remove'.

// A "patch" is an array of hunks that can be applied together. The hunks must
// not overlap. Adjacent insert-only hunks are applied in the order they appear
// in the array, otherwise order does not matter.

// A "revision" represents a user action that changed either the text, the
// cursor, or both. Revisions can be reverted. A revision is an object with
// these properties:

//      patch
//          The patch applied to the text.
//      cursor
//          The cursor after the patch was applied. Can be undefined if there
//          was no selection.
//      time
//          The timestamp of the user action, in milliseconds since the Unix
//          epoch. Revisions need not be ordered by timestamp.

// An editor's "state" wholly describes its current text, cursor, and revision
// history. It is an object with these properties:

//      text
//          The text at the current revision.
//      revisions
//          The array of revisions.
//      revision_nr
//          The current revision as an index into 'revisions', or -1 if prior to
//          the first revision.

/*jslint browser, global, null */

function normalize_line_endings(text) {
    return text.replace(/\r\n?/g, "\n");
}

// Cursors /////////////////////////////////////////////////////////////////////

function get_selection_range(element) {

// If a valid Selection lies within 'element', its Range is returned, otherwise
// undefined is returned.

    try {

// When the element is within a ShadowRoot, the major browsers behave very
// differently. See https://stackoverflow.com/a/70523247.

        const selection = (
            typeof element.getRootNode().getSelection === "function"
            ? element.getRootNode().getSelection() // Chrome
            : document.getSelection() // Firefox
        );
        const is_shadow = element.getRootNode() !== document;
        let range = selection.getRangeAt(0);
        if (is_shadow && typeof selection.getComposedRanges === "function") {

// Safari's proprietary 'getComposedRanges' method returns a StaticRange.
// Convert it into a real Range.

            const bogus = selection.getComposedRanges(element.getRootNode())[0];
            range = document.createRange();
            range.setStart(bogus.startContainer, bogus.startOffset);
            range.setEnd(bogus.endContainer, bogus.endOffset);
        }
        if (
            element.contains(range.startContainer)
            && element.contains(range.endContainer)
        ) {
            return range;
        }
    } catch (_) {}
}

function scroll_selection_into_view(
    scrollport,
    range,
    behavior = "auto" // respect CSS "scroll-behavior" property by default
) {
    if (range !== undefined) {
        const scrollport_rect = scrollport.getBoundingClientRect();
        const range_rect = range.getBoundingClientRect();
        const is_range_visible = (
            range_rect.bottom > scrollport_rect.top
            && range_rect.top < scrollport_rect.bottom
        );
        if (!is_range_visible) {
            scrollport.scrollTo({
                top: (
                    scrollport.scrollTop
                    + range_rect.top
                    - scrollport_rect.top
                    - scrollport_rect.height / 2 // vertically center cursor
                ),
                behavior
            });
        }

// An alternative implementation, using the 'scrollIntoViewIfNeeded' method, is
// preserved here in case 'scrollIntoViewIfNeeded' is ever implemented in
// Firefox and fixed in Safari.

/*
        const element_rect = element.getBoundingClientRect();
        const range_rect = range.getBoundingClientRect();
        const anchor = document.createElement("span");
        anchor.style.position = "absolute";
        anchor.style.top = element.scrollTop + (
            range_rect.top - element_rect.top
        ) + "px";
        element.prepend(anchor);
        if (typeof anchor.scrollIntoViewIfNeeded === "function") {
            anchor.scrollIntoViewIfNeeded(true);
        } else {
            anchor.scrollIntoView({block: "center"});
        }
        anchor.remove();
*/

    }
}

function next(node) {
    while (!node.nextSibling && node.parentNode) {
        node = node.parentNode;
    }
    return node.nextSibling;
}

function get_position(element, caret) {
    const walker = document.createTreeWalker(
        element,
        globalThis.NodeFilter.SHOW_TEXT + globalThis.NodeFilter.SHOW_ELEMENT
    );
    let [caret_node, caret_offset] = caret;
    if (typeof caret_node.nodeValue !== "string") {
        caret_node = caret_node.childNodes[caret_offset] ?? next(caret_node);
        caret_offset = 0;
    }
    let position = 0;
    while (true) {
        const node = walker.nextNode();
        if (node === null) {
            break;
        }
        if (node === caret_node) {
            position += caret_offset;
            break;
        }
        const text = node.nodeValue;
        if (typeof text === "string") {
            position += text.length;
        }
    }
    return position;
}

function get_caret(element, position) {
    const walker = document.createTreeWalker(
        element,
        globalThis.NodeFilter.SHOW_TEXT
    );

// Find the text node encompassing the position.

    while (true) {
        const node = walker.nextNode();
        if (node === null) {
            break;
        }
        const length = node.nodeValue.length;
        if (position <= length) {
            return [node, position];
        }
        position -= length;
    }

// If there were no text nodes, or the position was out of range, place the
// caret at the start of the element.

    return [element, 0];
}

function test_get_caret() {
    document.documentElement.innerHTML = "";
    const html = `
        <b>
            B
            <c> C </c>
            <d>
                D
                <e> E </e>
            </d>
        </b>
        <f> F </f>
        <g>
            G
            <h> H </h>
        </g>
    `;
    document.body.innerHTML = html.replace(/\s/g, "");
    const b = document.body.querySelector("b");
    const [caret_node, caret_offset] = get_caret(document.body, 4);
    if (
        get_position(document.body, [b, b.childNodes.length]) !== 4 // </d>|</b>
        || get_position(document.body, [document.body, 1]) !== 4    // </b>|<f>
        || caret_node.nodeValue !== "E"                             // "E|"
        || caret_offset !== 1
    ) {
        throw new Error("FAIL");
    }
}

function rangeify(cursor) {
    return [
        Math.min(...cursor),
        Math.max(...cursor)
    ];
}

function equal_cursors(a, b) {
    return a[0] === b[0] && a[1] === b[1];
}

// Alteration //////////////////////////////////////////////////////////////////

function sort_alterations(alterations) {
    return alterations.slice().sort(function (a, b) {
        return a.range[0] - b.range[0] || a.range[1] - b.range[1];
    });
}

function alter_string(string, alterations) {

// Applies an array of alterations to a string, returning the altered string.

    let position = 0;
    return sort_alterations(alterations).map(function ({range, replacement}) {
        const chunk = string.slice(position, range[0]) + replacement;
        position = range[1];
        return chunk;
    }).concat(
        string.slice(position)
    ).join(
        ""
    );
}

function alter_cursor(cursor, alterations) {

// Adjusts the cursor to accomodate an array of alterations. The cursor expands
// to encompass any alterations that it overlaps.

    const [cursor_start, cursor_end] = rangeify(cursor);
    let start = cursor_start;
    let end = cursor_end;
    alterations.forEach(function ({range, replacement}) {
        const [range_start, range_end] = range;
        const difference = replacement.length - (range_end - range_start);
        if (cursor_end > range_start) {

// rrrr         rrrr        rrrr        rrrr
//      cccc      cccc       cc       cccc

            end += difference + Math.max(0, range_end - cursor_end);
        }
        if (cursor_start < range_end) {

//      rrrr      rrrr      rrrr         rr       rrrr
// cccc         cccc         cc         cccc        cccc

            start += Math.min(0, range_start - cursor_start);
        } else {

// rrrr
//      cccc

            start += difference;
        }
    });
    return (
        cursor[0] > cursor[1]
        ? [end, start]
        : [start, end]
    );
}


function alter_element(element, alterations) {

// Exactly like 'alter_string', except that it alters the Text nodes
// within 'element' instead of altering a string.

    alterations = sort_alterations(alterations);

// Move thru the element's text nodes, applying the alterations in situ as they
// come into range. It is a bit tricky because alterations and text nodes can
// overlap.

    const walker = document.createTreeWalker(
        element,
        globalThis.NodeFilter.SHOW_TEXT
    );
    let position = 0;
    while (alterations.length > 0) {
        const node = walker.nextNode();
        if (node === null) {
            break;
        }
        const end = position + node.nodeValue.length;
        let correction = 0;
        while (alterations.length > 0 && alterations[0].range[0] < end) {

// This alteration begins somewhere within this node.

            let {range, replacement} = alterations.shift();
            if (range[1] > end) {

// But it does not end within this node, so split it into two alterations: a
// head to apply to this node, and a tail to apply to upcoming nodes. The whole
// replacement string gets added to this node, whereas upcoming nodes only have
// text removed.

                const head = [range[0], end];
                const tail = [end, range[1]];
                range = head;
                alterations.unshift({range: tail, replacement: ""});
            }
            const remove_length = range[1] - range[0];
            const remove_start = range[0] - position + correction;
            const prefix = node.nodeValue.slice(0, remove_start);
            const suffix = node.nodeValue.slice(remove_start + remove_length);
            node.nodeValue = prefix + replacement + suffix;
            correction += replacement.length - remove_length;
        }
        position = end;
    }

// Now to append any remaining alterations, which are not allowed to remove
// text, and must have a collapsed range positioned exactly at the end.

    const remnant = alterations.map(
        function ({range, replacement}) {
            if (range[0] !== position || range[1] !== position) {
                throw new Error("Out of range.");
            }
            return replacement;
        }
    ).join("");
    if (walker.currentNode === element) {

// The element contained no text nodes. Prepend the remnant, ensuring that
// any trailing <br> remains at the end.

        element.prepend(remnant);
    } else {
        walker.currentNode.nodeValue += remnant;
    }
}

function test_alter_element() {
    [
        {
            html: `
                012
                <span>345</span>
                <span>6<span>78</span>9</span>
            `,
            alterations: [
                {range: [0, 0], replacement: "A"},
                {range: [2, 4], replacement: "BBCC"},
                {range: [4, 4], replacement: "D"},
                {range: [6, 7], replacement: ""},
                {range: [10, 10], replacement: "E"},
                {range: [8, 9], replacement: ""},
                {range: [10, 10], replacement: "FG"}
            ],
            expected_text: "A01BBCCD4579EFG"
        },
        {
            html: "",
            alterations: [{range: [0, 0], replacement: "not empty"}],
            expected_text: "not empty"
        }
    ].forEach(function ({html, alterations, expected_text}) {
        const div = document.createElement("div");
        div.innerHTML = html.replace(/\s/g, ""); // discard whitespace
        const original_text = div.textContent;
        alter_element(div, alterations);
        if (
            div.textContent !== alter_string(original_text, alterations)
            || div.textContent !== expected_text
        ) {
            throw new Error("FAIL alter_element " + div.textContent);
        }
    });
}

// Diffing and patching ////////////////////////////////////////////////////////

function to_patch(alterations, text) {
    return alterations.map(function (alteration) {
        return {
            remove: text.slice(...alteration.range),
            insert: alteration.replacement,
            position: alteration.range[0]
        };
    });
}

function to_alterations(patch, text) {

// Convert an array of hunks into an array of alterations. If a hunk does not
// apply cleanly, the corresponding element in the returned array is undefined.

    return patch.map(function (hunk) {
        const remove_range = [
            hunk.position,
            hunk.position + hunk.remove.length
        ];
        if (text.slice(...remove_range) === hunk.remove) {
            return {
                range: remove_range,
                replacement: hunk.insert
            };
        }
    });
}

function invert_patch(patch) {

// Return a patch that reverses the effects of 'patch'.

    let offset = 0;
    return patch.map(function (hunk) {
        const reversed_hunk = {
            remove: hunk.insert,
            insert: hunk.remove,
            position: hunk.position + offset
        };
        offset += hunk.insert.length - hunk.remove.length;
        return reversed_hunk;
    });
}

function test_invert_patch() {
    const text = "Lorem ipsum dolor sit amet, consectetur elit.";
    const alterations = [
        {range: [0, 5], replacement: "Morsel"},
        {range: [22, 26], replacement: "up"},
        {range: [26, 28], replacement: "..."}
    ];
    const altered_text = alter_string(text, alterations);
    const patch = to_patch(alterations, text);
    const reverse_patch = invert_patch(patch);
    const reverse_alterations = to_alterations(reverse_patch, altered_text);
    if (alter_string(altered_text, reverse_alterations) !== text) {
        throw new Error("FAIL");
    }
}

function rudimentary_diff(a, b) {

// Perform a rudimentary diff of two strings, returning an array of alterations.
// It simply identifies the common prefix and suffix of the two strings, then
// assumes the text in between was replaced.

    if (a === b) {
        return [];
    }
    let pre = 0;
    while (pre < a.length && pre < b.length) {
        if (a[pre] === b[pre]) {
            pre += 1;
        } else {
            break;
        }
    }
    let post = 0;
    while (post < a.length - pre && post < b.length - pre) {
        if (a[a.length - 1 - post] === b[b.length - 1 - post]) {
            post += 1;
        } else {
            break;
        }
    }
    return [{
        range: [pre, a.length - post],
        replacement: b.slice(pre, b.length - post)
    }];
}

function test_rudimentary_diff() {
    [
        ["", "", []],
        ["abc", "abc", []],
        ["abc", "Abc", [{range: [0, 1], replacement: "A"}]],
        ["abc", "aBc", [{range: [1, 2], replacement: "B"}]],
        ["abc", "abC", [{range: [2, 3], replacement: "C"}]],
        ["a", "aa", [{range: [1, 1], replacement: "a"}]]
    ].forEach(function ([a, b, expected]) {
        const actual = rudimentary_diff(a, b);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error("FAIL");
        }
    });
}

// Undo and redo ///////////////////////////////////////////////////////////////

// To avoid tedious undoing and redoing, we can skim over revisions that were
// made in quick succession, or that only changed the cursor. This is
// accomplished by aggregating revisions into "flurries" of activity, ignoring
// any flurries where the text did not change.

function find_textual_flurry(at, revisions, direction, pause) {
    let flurry = [];
    while (at >= 0 && at < revisions.length) {
        const revision = revisions[at];
        if (revision.patch.length > 0) {
            flurry.push(at);
        }
        const next_revision = revisions[at + direction];
        at += direction;
        if (
            next_revision !== undefined
            && Math.abs(next_revision.time - revision.time) >= pause
            && flurry.length > 0
        ) {
            break;
        }
    }
    return [flurry, at];
}

function skim_undo(from, revisions, pause) {
    const [flurry] = find_textual_flurry(from, revisions, -1, pause);
    if (flurry.length > 0) {
        return flurry.pop() - 1;    // Just prior to the most recent flurry.
    }
}

function skim_redo(from, revisions, pause) {
    const [flurry] = find_textual_flurry(from + 1, revisions, 1, pause);
    return flurry.pop();            // Just after the next flurry.
}

function test_skim() {
    const pause = 10;
    const x = undefined;
    [
        [
            {time: x, undo: x, redo: x}
        ],
        [
            {time: x, undo: x, redo: 0},
            {time: 0, undo: -1, redo: x, textual: true}
        ],
        [
            {time: x, undo: x, redo: x},
            {time: 20, undo: x, redo: x},
            {time: 21, undo: x, redo: x},
            {time: 60, undo: x, redo: x},
            {time: 61, undo: x, redo: x}
        ],
        [
            {time: x, undo: x, redo: 1},
            {time: 0, undo: -1, redo: 1, textual: true},
            {time: 1, undo: -1, redo: 3, textual: true},
            {time: 20, undo: 1, redo: 3, textual: true},
            {time: 21, undo: 1, redo: x, textual: true}
        ],
        [
            {time: x, undo: x, redo: 3},
            {time: 100, undo: x, redo: 3},
            {time: 120, undo: 0, redo: 3, textual: true},
            {time: 121, undo: 0, redo: 3, textual: true},
            {time: 122, undo: 0, redo: 6, textual: true},
            {time: 140, undo: 0, redo: 6},
            {time: 141, undo: 0, redo: 6},
            {time: 160, undo: 5, redo: 11, textual: true},
            {time: 161, undo: 5, redo: 11},
            {time: 180, undo: 5, redo: 11},
            {time: 181, undo: 8, redo: 11, textual: true},
            {time: 182, undo: 8, redo: 11, textual: true},
            {time: 183, undo: 8, redo: x, textual: true},
            {time: 200, undo: 8, redo: x}
        ]
    ].forEach(function (test, test_nr) {
        const revisions = test.slice(1).map(function ({time, textual}) {
            return {
                patch: (
                    textual === true
                    ? [{}]
                    : []
                ),
                time
            };
        });
        test.forEach(function (step, step_nr) {
            const from = step_nr - 1; // history begins at -1
            const undo = skim_undo(from, revisions, pause);
            if (undo !== step.undo) {
                throw new Error(
                    "FAIL skim_undo " + test_nr + "[" + step_nr + "] -> " + undo
                );
            }
            const redo = skim_redo(from, revisions, pause);
            if (redo !== step.redo) {
                throw new Error(
                    "FAIL skim_redo " + test_nr + "[" + step_nr + "] -> " + redo
                );
            }
        });
    });
}

// Event handling //////////////////////////////////////////////////////////////

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

// The editor //////////////////////////////////////////////////////////////////

function ed({

// The DOM element holding the text. It will be made contenteditable during
// initialization. Required.

    element,

// The state of the editor, including its history and text.

    state = {
        revisions: [],
        revision_nr: -1,
        text: element.textContent
    },

// The 'highlight' function, if provided, is called whenever the text
// in 'element' changes. It can provide syntax highlighting by manipulating the
// DOM nodes inside 'element', but it is not allowed to change the value
// of 'element.textContent'.

// For an acceptable user experience, 'highlight' must complete its work
// quickly. If it can not return within, say, 30ms, it should defer its work
// for a future time.

    highlight,

// Called each time a 'keydown' event is emitted by 'element'. It can detect and
// act on keyboard shortcuts. It is passed the KeyboardEvent, whose
// 'defaultPrevented' property is true if the event has already been handled.

    on_keydown,

// Called each time the state of the editor changes, which could be due to the
// text changing, the selection changing, or both. It is passed the revision
// object.

    on_revision,

// Called each time the user navigates the history, via undo or redo. It is
// called with an offset, for example 5 if the history moved forward 5
// revisions, or -2 if the history moved backward 2 revisions.

    on_travel,

// User edits that take place within 'pause' milliseconds of each other are
// aggregated together for the purposes of undoing and redoing.

    pause = 400,

// Browsers will not render an element's trailing newline, if it has one. In
// contenteditable elements, this frustrates the user by rejecting their cursor
// from the last line if it is blank.

// A crude yet reliable way to render a trailing newline is to maintain a <br>
// as the element's last child. The <br> will be invisible to the element's
// 'textContent' property.

// When 'sticky_br' is true (the default), a <br> is automatically maintained at
// the end of 'element'. When 'sticky_br' is false, this behavior is disabled
// and it becomes the responsibility of the 'highlight' function to ensure that
// the trailing newline is rendered.

    sticky_br = true,

// After undoing or redoing, the editor will attempt to scroll the cursor into
// view. If 'element' itself does not scroll, the 'scrollport' should be its
// nearest scrolling ancestor element, or 'document.documentElement' to scroll
// the whole page.

    scrollport = element,

// Override the string diff function used to calculate patches. It takes two
// strings and returns an array of alterations.

    diff = rudimentary_diff
}) {
    let at;
    let br;
    let br_observer;
    let last_known_text;
    let revisions;

    function get_text() {
        return element.textContent;
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
        const selection = document.getSelection();
        if (cursor !== undefined) {
            const anchor = get_caret(element, cursor[0]);
            const focus = get_caret(element, cursor[1]);

// Calling the selection's methods can force a layout reflow, so we do that only
// if the selection actually needs to change.

            if (
                selection.anchorNode !== anchor[0]
                || selection.anchorOffset !== anchor[1]
                || selection.focusNode !== focus[0]
                || selection.focusOffset !== focus[1]
            ) {
                selection.setBaseAndExtent(...anchor, ...focus);
            }
        } else {
            if (selection.rangeCount > 0) {
                selection.removeAllRanges();
            }
        }
    }

    function show_cursor(behavior) {
        scroll_selection_into_view(
            scrollport,
            get_selection_range(element),
            behavior
        );
    }

    function near(x, y) {

// Return the nearest position to a set of viewport coordinates, or undefined if
// the coordinates are out of bounds.

// The ideal method is 'caretPositionFromPoint' because it works within
// ShadowRoots, unlike 'caretRangeFromPoint', although Chrome does require us to
// explicitly provide every containing ShadowRoot.

        if (document.caretPositionFromPoint !== undefined) {
            const {offsetNode, offset} = document.caretPositionFromPoint(x, y, {
                shadowRoots: (function upward(node, roots) {
                    return (
                        node === null
                        ? roots
                        : (
                            node.constructor === globalThis.ShadowRoot
                            ? upward(node.host, roots.concat(node))
                            : upward(node.parentNode, roots)
                        )
                    );
                }(element, []))
            });
            return get_position(element, [offsetNode, offset]);
        }

// The fallback is slower. We enumerate each position and choose the closest.
// This can be removed once there is widespread support for
// 'caretPositionFromPoint'.

        let closest;
        new Array(get_text().length + 1).fill().forEach(function (_, position) {
            const caret = get_caret(element, position);
            const range = document.createRange();
            range.setStart(...caret);
            range.setEnd(...caret);
            const {left, top, bottom} = range.getBoundingClientRect();
            const middle = (top + bottom) / 2;
            const distance = Math.sqrt((left - x) ** 2 + (middle - y) ** 2);
            if (closest === undefined || distance < closest.distance) {
                closest = {position, distance};
            }
        });
        return closest?.position;
    }

    function commit(patch, cursor) {

// Commit a revision to the history. Do nothing if the patch changes neither the
// text nor cursor. The redo stack is discarded if the patch changes the text.

        const cursor_changed = cursor !== undefined && (
            revisions[at]?.cursor === undefined
            || !equal_cursors(cursor, revisions[at].cursor)
        );
        if (patch.length > 0 || cursor_changed) {
            const revision = {
                patch,
                cursor,
                time: Date.now()
            };
            at += 1;
            if (patch.length > 0) {
                revisions.length = at; // discard redo stack
            }
            revisions.splice(at, 0, revision);
            if (typeof on_revision === "function") {
                on_revision(revision);
            }
        }
    }

    function edit(
        alterations,
        cursor = alter_cursor(get_cursor(), alterations)
    ) {
        const patch = to_patch(alterations, element.textContent);
        alter_element(element, alterations);
        commit(patch, cursor);
        last_known_text = alter_string(last_known_text, alterations);
        if (highlight !== undefined) {
            highlight(element);
        }
        set_cursor(cursor);
    }

    function insert(text) {
        const range = rangeify(get_cursor());
        const alterations = [{
            range,
            replacement: text
        }];
        const edge = range[0] + text.length;
        const cursor = [edge, edge];
        edit(alterations, cursor);
    }

    function refresh_cursor() {
        set_cursor(revisions[at]?.cursor);
    }

    function checkout(to) {

// Apply a sequence of patches that will transport the visible and text and
// cursor to revision 'to'. If 'to' is out of range, it is clamped.

        to = Math.max(-1, Math.min(to, revisions.length - 1));
        const offset = to - at;
        const patches = (
            offset < 0
            ? revisions.slice(to + 1, at + 1).reverse().map(
                (revision) => invert_patch(revision.patch)
            )
            : revisions.slice(at + 1, to + 1).map(
                (revision) => revision.patch
            )
        );

// Apply each patch until there are none left, or we encounter a merge conflict.

        let text = element.textContent;
        patches.every(function (patch) {
            const alterations = to_alterations(patch, text);
            if (alterations.includes(undefined)) {
                debugger; // there should never be a merge conflict!
                return false;
            }
            text = alter_string(text, alterations);
            alter_element(element, alterations);
            at += (
                offset < 0
                ? -1
                : 1
            );
            return true;
        });
        last_known_text = text;
        if (highlight !== undefined) {
            highlight(element);
        }
        refresh_cursor();
        return offset;
    }

    function get_state() {
        return {
            text: get_text(),
            revisions: revisions.slice(),
            revision_nr: at
        };
    }

    function set_state(new_state) {
        revisions = new_state.revisions.slice();
        at = new_state.revision_nr;
        last_known_text = new_state.text;
        element.textContent = new_state.text;
        if (highlight !== undefined) {
            highlight(element);
        }
        refresh_cursor();
    }

    function travel(direction, skim) {
        const to = (
            skim
            ? (
                direction < 0
                ? skim_undo(at, revisions, pause)
                : skim_redo(at, revisions, pause)
            )
            : at + direction
        );
        if (Number.isSafeInteger(to)) {
            const offset = checkout(to);
            if (offset !== 0) {
                if (typeof on_travel === "function") {
                    on_travel(offset);
                }
                show_cursor();
            }
        }
    }

    function keydown(event) {

// On macOS, ⌘⌥Z has 'event.key' as "Ω", so we use 'event.code' instead.

        if (is_command(event) && event.code === "KeyZ") {
            event.preventDefault();
            const direction = (
                event.shiftKey
                ? 1
                : -1
            );
            travel(direction, !event.altKey);
        }
        if (on_keydown !== undefined) {
            on_keydown(event);
        }
        if (event.defaultPrevented) {
            return;
        }
        if (event.key === "Enter") {

// Browsers insert a <br> on Enter, but we just want a newline character.

            event.preventDefault();
            insert("\n");

// An alternative method for inserting a linebreak is preserved here, just in
// case it is ever needed.

/*

function is_gecko() {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "plaintext-only");
    return div.contentEditable !== "plaintext-only";
}

// Browsers insert <div><br></div> on Enter, but we just want \n.

// Inserting a lone \n is not straightforward. In Firefox, the insertLineBreak
// command inserts <br>, but in Chrome and Safari browsers it inserts \n. On the
// other hand, the insertHTML command does not correctly update the selection in
// Chrome and Safari.

if (is_gecko()) {
    document.execCommand("insertHTML", false, "\n");
} else {
    document.execCommand("insertLineBreak", false);
}

*/

        }
        if (event.key === "Backspace" || event.key === "Delete") {
            const cursor = get_cursor();

// If a word follows a whitespace character, and the word is selected via a
// double click and then deleted, browsers also delete the whitespace!

            if (cursor[0] !== cursor[1]) {
                event.preventDefault();
                insert("");
            }
        }
    }

    function input(event) {
        if (!event.isComposing) {
            const text = element.textContent;
            const cursor = get_cursor();
            const alterations = diff(last_known_text, text);
            const patch = to_patch(alterations, last_known_text);
            last_known_text = text;
            commit(patch, cursor);
            if (highlight !== undefined) {
                highlight(element);
                set_cursor(cursor);
            }
        }
    }

    function paste(event) {

// Pasting almost works fine without intervention, except that leading newlines
// are lost.

        event.preventDefault();

// It is very possible that the pasted text is similar to what it is replacing,
// so we may be able to infer a smaller patch.

        const cursor = get_cursor();
        const [start, end] = rangeify(cursor);
        const original = element.textContent.slice(start, end);
        const pasted = normalize_line_endings(
            event.clipboardData.getData("text/plain")
        );
        const alterations = diff(
            original,
            pasted
        ).map(function ({range, replacement}) {
            return {
                range: [
                    start + range[0],
                    start + range[1]
                ],
                replacement
            };
        });

// Collapse the cursor and relocate it to the end of the selected region.

        const caret = end + (pasted.length - original.length);
        edit(alterations, [caret, caret]);
    }

    function selectionchange() {
        commit([], get_cursor());
    }

    function ensure_br() {
        if (element.lastChild !== br) {
            element.append(br);
        }
    }

    function destroy() {
        document.removeEventListener("selectionchange", selectionchange);
        element.removeEventListener("keydown", keydown);
        element.removeEventListener("input", input);
        element.removeEventListener("paste", paste);
        if (br_observer !== undefined) {
            br_observer.disconnect();
        }
    }
    document.addEventListener("selectionchange", selectionchange);
    element.addEventListener("keydown", keydown);
    element.addEventListener("input", input);
    element.addEventListener("paste", paste);
    element.contentEditable = "true";
    element.spellcheck = false;
    set_state(state);
    if (sticky_br) {
        br = document.createElement("br");
        ensure_br();
        br_observer = new MutationObserver(ensure_br);
        br_observer.observe(element, {childList: true});
    }
    return {
        get_state,
        set_state,
        show_cursor,
        insert,
        edit,
        get_text,
        get_cursor,
        near,
        checkout,
        is_command,
        destroy
    };
}

// Demo ////////////////////////////////////////////////////////////////////////

function visualize_selection_range(node, range) {
    const caret_anchor = "▶";
    const caret_focus = "◀";
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

const colors = ["red", "purple", "orange", "green", "blue"];

function demo_highlight(element) {
    const text = element.textContent;
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

function demo() {
    document.documentElement.innerHTML = "";
    const source = document.createElement("text_editor");
    source.style.flex = "1 1 50%";
    source.style.whiteSpace = "pre";
    source.style.caretColor = "black";
    source.style.fontFamily = "monospace";
    source.style.outline = "none";
    source.style.padding = "0 5px";
    source.style.overflowY = "auto";
    source.textContent = "abc\ndef\nstuff\nthings\n";
    const preview = document.createElement("html_preview");
    preview.style.flex = "1 1 50%";
    preview.style.whiteSpace = "pre";
    preview.style.fontFamily = "monospace";
    preview.style.overflowY = "auto";
    document.documentElement.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.height = "100%";
    document.body.style.display = "flex";
    const shadow = document.body.attachShadow({mode: "closed"});
    shadow.append(source, preview);
    // document.body.append(source, preview);

    function refresh_preview() {
        preview.textContent = (
            "HTML\n"
            + visualize_selection_range(source, get_selection_range(source))
            + "\nTEXT\n"
            + JSON.stringify(source.textContent)
        );
    }

    const editor = ed({
        element: source,
        pause: 1000,
        highlight() {
            return demo_highlight(source);
        },
        on_revision(revision) {
            globalThis.console.log("on_revision", revision);
        },
        on_travel(offset) {
            const to = editor.get_state().revision_nr;
            const from = to - offset;
            globalThis.console.log("on_travel", from, "->", to);
        },
        on_keydown(event) {
            if (!event.defaultPrevented && event.key === "Tab") {
                event.preventDefault();
                editor.insert("    ");
            }
        }
    });
    editor.set_state({
        text: "abc\ndef\nstuff\nthings\n".repeat(100),
        revisions: [{
            patch: [],
            cursor: [8, 27],
            time: Date.now()
        }],
        revision_nr: 0
    });
    globalThis.oninput = refresh_preview;
    document.onselectionchange = refresh_preview;
    refresh_preview();
    source.focus();
    source.onclick = function (event) {
        globalThis.console.log(
            "near",
            editor.near(event.clientX, event.clientY)
        );
    };
}

if (import.meta.main) {
    test_alter_element();
    test_invert_patch();
    test_rudimentary_diff();
    test_get_caret();
    test_skim();
    demo();
}

export default Object.freeze(ed);
