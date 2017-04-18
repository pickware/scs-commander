const axios = require('axios');
const Program = require('commander');
const Chalk = require('chalk');

module.exports = async (pluginInfo) => {
    if (typeof Program.releaseEventURL !== 'undefined') {
        try {
            await axios
                .post(Program.releaseEventURL, {
                    pluginName: pluginInfo.getName(),
                    pluginVersion: pluginInfo.getCurrentVersion(),
                    pluginLabel: {
                        de: pluginInfo.getLabel('de'),
                        en: pluginInfo.getLabel('en'),
                    },
                    pluginChangelog: {
                        de: pluginInfo.getChangelog('de', null),
                        en: pluginInfo.getChangelog('en', null),
                    },
                });
            console.log(Chalk.green.bold('Publish release event succeeded'));
        } catch (err) {
            console.log(Chalk.red.bold(`Publish release event failed: ${err.message}`));
        }
    }

    return true;
};
