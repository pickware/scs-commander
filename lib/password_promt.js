const co = require('co');
const Prompt = require('co-prompt');

module.exports = (program) => {
    if (program.password) {
        // Use given password
        return Promise.resolve(program.password);
    }

    // Prompt for password
    return co.wrap(function* () {
        return yield Prompt.password('Password: ');
    })();
};
