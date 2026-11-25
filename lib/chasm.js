//
// CHASM - Classic Hewitt Actor Semantic Model
//
// Based on https://dalnefre.com/wp/2024/04/classic-actor-semantic-model/
//

/*jslint global, long */

let log = function log(/*...args*/) {
    return undefined;
};

function new_theater() {

    let next_address = 0;
    function new_address() {
        const address = next_address;
        next_address += 1;
        return address;
    }

    function new_config(config) {
        const actors = Object.create(null);
        const events = [];
        if (config) {
            Object.assign(actors, config.actors);
            events.concat(config.events);
        }

        function actor_create(behavior) {
            const address = new_address();
            actors[address] = behavior;
            return address;
        }

        function actor_send(address, message) {
            const event = {
                target: address,
                message
            };
            events.push(event);
        }

        function step(choice = 0) {
            if (events.length === 0) {
                return false;
            }
            const event = events[choice];
            events.splice(choice, 1);  // remove chosen event
            const self = event.target;
            const behavior = actors[self];
            const effect = new_effect(behavior);
            if (behavior(event, effect)) {
                // apply effect on success
                actors[self] = effect.behavior;
                Object.assign(actors, effect.actors);
                events.push(...effect.events);
            }
            return true;
        }

        return {
            actor_create,
            actor_send,
            step,
            actors,
            events
        };
    }

    function new_effect(behavior) {
        const effect = new_config();
        delete effect.step;  // only step configs
        effect.behavior = behavior;
        effect.actor_become = function actor_become(behavior) {
            effect.behavior = behavior;
        };
        return effect;
    }

    return {
        new_config
    };
}

function sink_beh() {
    return true;
}

function println_beh(event, _) {
    log(event.message);
    return true;
}

function test_theater() {
    function boot_beh(_, effect) {
        const a_println = effect.actor_create(println_beh);
        effect.actor_send(a_println, 42);
        effect.actor_become(sink_beh);
        return true;
    }

    const theater = new_theater();
    const config = theater.new_config();
    log(config);
    const a_boot = config.actor_create(boot_beh);
    config.actor_send(a_boot);
    log(config);
    log(config.step());
    log(config);
    log(config.step());
    log(config);
    log(config.step());
    log(config);
}

function test_fib() {
    function fib_k2(cust, m) {
        return function fib_k2_beh(event, effect) {  // cust,m <- {n}
            effect.actor_send(cust, {n: m + event.message.n});
            effect.actor_become(sink_beh);
            return true;
        };
    }

    function fib_k(cust) {
        return function fib_k_beh(event, effect) {  // cust <- {n}
            effect.actor_become(fib_k2(cust, event.message.n));
            return true;
        };
    }

    function fib_beh(event, effect) {  // _ <- {cust,n}
        const n = event.message.n;
        if (n > 1) {
            const a_fib_k = effect.actor_create(fib_k(event.message.cust));
            const a_self = event.target;
            effect.actor_send(a_self, {cust: a_fib_k, n: n - 1});
            const a_fib = effect.actor_create(fib_beh);
            effect.actor_send(a_fib, {cust: a_fib_k, n: n - 2});
        } else {
            effect.actor_send(event.message.cust, {n});
        }
        return true;
    }

    function boot_beh(event, effect) {  // _ <- _
        const a_fib = effect.actor_create(fib_beh);
        effect.actor_send(a_fib, {cust: event.target, n: 6});  // ==> 8
        // effect.actor_send(a_fib, {cust: event.target, n: 9});  // ==> 34
        effect.actor_become(println_beh);
        return true;
    }

    const theater = new_theater();
    const config = theater.new_config();
    const a_boot = config.actor_create(boot_beh);
    config.actor_send(a_boot);
    while (config.step()) {
        log(config);
    }
}

if (import.meta.main) {
    log = function log(...args) {
        globalThis.console.log(...args);
    };

    test_theater();
    test_fib();
}

export default Object.freeze({
    sink_beh,
    println_beh,
    new_theater
});
