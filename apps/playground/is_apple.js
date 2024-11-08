/*jslint browser */

function is_apple() {
    return (
        navigator.platform.startsWith("Mac")
        || navigator.platform === "iPhone"
        || navigator.platform === "iPad"
        || navigator.platform === "iPod"
    );
}

export default Object.freeze(is_apple);
