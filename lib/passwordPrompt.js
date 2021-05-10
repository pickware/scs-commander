const co = require('co');
const Prompt = require('co-prompt');

module.exports = async (program) => {
    if (program.opts().password) {
        // Use given password
        return program.opts().password;
    }

    // Prompt for password
    return co.wrap(function* () {
        return yield Prompt.password('Password: ');
    })();
};
