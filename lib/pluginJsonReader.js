const fs = require('mz/fs');
const JSZip = require('jszip');
const PluginInfo = require('./pluginInfo');

module.exports = class PluginJSONReader {

    /**
     * @param {String} filePath
     * @return {Promise}
     */
    readZip(filePath) {
        return fs.exists(filePath).then((exists) => {
            if (!exists) {
                throw new Error(`File ${filePath} does not exist`);
            }

            return fs.readFile(filePath);
        }).then(data => JSZip.loadAsync(data)).then((zip) => {
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

            return zip.file(pluginJsonFile).async('string').then((pluginJsonString) => {
                const json = JSON.parse(pluginJsonString);

                return new PluginInfo(pluginName, json);
            });
        });
    }

};
