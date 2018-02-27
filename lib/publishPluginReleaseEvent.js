const axios = require('axios');
const Program = require('commander');
const Chalk = require('chalk');

/**
 * Create a release event object from a pluginInfo object.
 *
 * @param {Object} pluginInfo
 * @return {Object}
 */
function getReleaseEventInfo(pluginInfo) {
    return {
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
    };
}

/**
 * If set call the release event endpoint.
 *
 * @param {Object} pluginInfo
 * @return {Boolean}
 */
module.exports = async (pluginInfo) => {
    if (!Program.releaseEventURL) {
        return;
    }
    try {
        await axios.post(Program.releaseEventURL, getReleaseEventInfo(pluginInfo));
        console.error(Chalk.green.bold('Publish release event succeeded'));
    } catch (err) {
        console.error(Chalk.red.bold(`Publish release event failed: ${err.message}`));
    }
};
