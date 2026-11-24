//
// CHASM - Classic Hewitt Actor Semantic Model
//
// Based on https://dalnefre.com/wp/2024/04/classic-actor-semantic-model/
//

/*jslint global, long */

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
                events.concat(effect.events);
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

// if (import.meta.main) {
//     test_theater();
// }

export default Object.freeze({new_theater});
