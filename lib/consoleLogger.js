const Chalk = require('chalk');

/**
 * Register logging related consumers.
 *
 * @param {EventEmitter} emitter
 */
module.exports = (emitter) => {
    emitter.on('error', (message) => {
        console.error(Chalk.white.bgRed.bold(message));
    });
    emitter.on('info', (message) => {
        console.log(message);
    });
};
