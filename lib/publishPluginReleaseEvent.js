const axios = require('axios');
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
            de: plugin.releaseNotes.de.toHtml(),
            en: plugin.releaseNotes.en.toHtml(),
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
    if (!process.env.SCS_RELEASE_EVENT_ENDPOINT) {
        return;
    }
    try {
        await axios.post(process.env.SCS_RELEASE_EVENT_ENDPOINT, getReleaseEventInfo(plugin));
        console.error(Chalk.green.bold('Publish release event succeeded'));
    } catch (err) {
        console.error(Chalk.red.bold(`Publish release event failed: ${err.message}`));
    }
};
