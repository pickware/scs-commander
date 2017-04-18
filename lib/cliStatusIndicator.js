const Chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;

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

module.exports = (emitter) => {
    emitter.on('loggingIn', () => {
        spinner.setSpinnerTitle('Logging in...');
        startCLISpinner();
    });
    emitter.on('startHTTPRequest', () => {
        startCLISpinner();
    });
    emitter.on('endHTTPRequest', () => {
        resetCLISpinner();
    });
    emitter.on('loginSuccessful', () => {
        resetCLISpinner();
        console.log(Chalk.green.bold('Login successful! \u{1F513}'));
    });
};
