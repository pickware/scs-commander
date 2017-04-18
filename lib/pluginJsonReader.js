const fs = require('mz/fs');
const JSZip = require('jszip');
const PluginInfo = require('./pluginInfo');

module.exports = class PluginJSONReader {

    /**
     * @param {String} filePath
     * @return {Promise}
     */
    async readZip(filePath) {
        const exists = await fs.exists(filePath);
        if (!exists) {
            throw new Error(`File ${filePath} does not exist`);
        }

        const data = await fs.readFile(filePath);
        const zip = await JSZip.loadAsync(data);
        // Locate the plugin.json and determine the plugin name
        let pluginName;
        const pluginJsonFile = Object.keys(zip.files).find((key) => {
            const matches = key.match(/(Backend|Core|Frontend)\/([^/]+)\/plugin\.json/);
            if (matches && matches.length >= 3) {
                pluginName = matches[2];
            }

            return matches;
        });
        if (!pluginName || !pluginJsonFile) {
            return null;
        }

        const pluginJsonString = await zip.file(pluginJsonFile).async('string');
        const json = JSON.parse(pluginJsonString);

        return new PluginInfo(pluginName, json);
    }

};
