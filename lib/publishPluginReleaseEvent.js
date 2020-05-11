const axios = require('axios');
const Program = require('commander');
const Chalk = require('chalk');

/**
 * Create a release event object from a Plugin object.
 *
 * @param {Plugin} plugin
 * @return {Object}
 */
function getReleaseEventInfo(plugin) {
    return {
        pluginName: plugin.technicalName,
        pluginVersion: plugin.version,
        pluginLabel: plugin.label,
        pluginChangelog: {
            de: plugin.changelog.filterBy({
                locale: 'de',
                version: plugin.version,
            }).toHtml(),
            en: plugin.changelog.filterBy({
                locale: 'en',
                version: plugin.version,
            }).toHtml(),
        },
    };
}

/**
 * If set call the release event endpoint.
 *
 * @param {Plugin} plugin
 * @return {Boolean}
 */
module.exports = async (plugin) => {
    if (!Program.releaseEventURL) {
        return;
    }
    try {
        await axios.post(Program.releaseEventURL, getReleaseEventInfo(plugin));
        console.error(Chalk.green.bold('Publish release event succeeded'));
    } catch (err) {
        console.error(Chalk.red.bold(`Publish release event failed: ${err.message}`));
    }
};
