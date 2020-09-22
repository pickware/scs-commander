const execa = require('execa');
const path = require('path');

module.exports = {
    satisfies(version, constraint) {
        try {
            execa.sync(
                'php',
                [
                    'composer-semver-satisfies',
                    version,
                    constraint,
                ],
                {
                    cwd: path.join(__dirname, '../bin/'),
                },
            );

            return true;
        } catch (error) {
            if (error.exitCode === 1) {
                return false;
            }

            throw error;
        }
    },
};
