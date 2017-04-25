const Chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;
const consoleLogger = require('./consoleLogger');

// Prepare the loading spinner
const spinner = new Spinner();
spinner.setSpinnerString(11);

function startCLISpinner() {
    if (!spinner.isSpinning()) {
        spinner.start();
    }
}

function resetCLISpinner() {
    spinner.setSpinnerTitle('');
    if (spinner.isSpinning()) {
        spinner.stop(true);
    }
}

/**
 * Attach the consoleLogger to the emitter and register spinner related consumers.
 *
 * @param {EventEmitter} emitter
 */
module.exports = (emitter) => {
    consoleLogger(emitter);
    emitter.on('loggingIn', () => {
        spinner.setSpinnerTitle('Logging in...');
        startCLISpinner();
    });
    emitter.on('startHttpRequest', () => {
        startCLISpinner();
    });
    emitter.on('endHttpRequest', () => {
        resetCLISpinner();
    });
    emitter.on('loginSuccessful', () => {
        resetCLISpinner();
        emitter.emit('info', Chalk.green.bold('Login successful! \u{1F513}'));
    });
    emitter.on('waitingReview', () => {
        spinner.setSpinnerTitle('Waiting for review to finish...');
        startCLISpinner();
    });
};
