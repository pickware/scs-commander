const Chalk = require('chalk');

module.exports = (emitter) => {
    emitter.on('error', (message) => {
        console.error(Chalk.white.bgRed.bold(message));
    });
    emitter.on('info', (message) => {
        console.log(message);
    });
};
