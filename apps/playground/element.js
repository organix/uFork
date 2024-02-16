// The 'element' function creates a new DOM element with the specified 'tag'
// name, or modifies an existing element.

// The 'properties' parameter is an object containing values to assign to the
// element's properties.

// The 'children' parameter is either a string or an array of elements.

// The 'properties' parameter may be omitted.

/*jslint browser */

function element(tag, properties = {}, children = []) {
    if (typeof properties === "string" || Array.isArray(properties)) {
        children = properties;
        properties = {};
    }
    if (!Array.isArray(children)) {
        children = [children];
    }
    const the_element = (
        typeof tag === "string"
        ? document.createElement(tag)
        : tag
    );
    the_element.append(...children);
    Object.keys(properties).forEach(function (name) {
        the_element[name] = properties[name];
    });
    Object.assign(the_element.style, properties.style);
    return the_element;
}

export default Object.freeze(element);
