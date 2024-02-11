// The SVG device draws into an SVG element, based on the commands it receives.

const svg_key = 101; // from dev.asm

function svg_dev(core, make_ddev, svg_element) {
    const ddev = make_ddev(function on_event_stub(ptr) {
        const event_stub = core.u_read_quad(ptr);
        const event = core.u_read_quad(event_stub.y);
        const message = core.u_fix_to_i32(event.y);
        svg_element.innerHTML += `<text x=10 y=10>${message}</text>`;
    });
    const svg_proxy = ddev.h_reserve_proxy();
    core.h_install([[core.u_fixnum(svg_key), svg_proxy]]);
}

export default Object.freeze(svg_dev);
