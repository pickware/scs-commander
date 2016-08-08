'use strict';

var fs = require('mz/fs');
var JSZip = require('jszip');
var PluginInfo = require('./plugin_info');

module.exports = class PluginJSONReader {

    /**
     * @param {String} filePath
     * @return {Promise}
     */
    readZip(filePath) {
        return fs.exists(filePath).then(exists => {
            if (!exists) {
                throw new Error(`File ${filePath} does not exist`)
            }

            return fs.readFile(filePath);
        }).then(data => {
            return JSZip.loadAsync(data);
        }).then(zip => {
            // Locate the plugin.json
            var pluginJsonFile = Object.keys(zip.files).find(key => {
                return key.match(/(Backend|Core|Frontend)\/[^\/]+\/plugin\.json/);
            });
            if (!pluginJsonFile) {
                return null;
            }

            return zip.file(pluginJsonFile).async('string')
        }).then(pluginJsonString => {
            var json = JSON.parse(pluginJsonString);

            return new PluginInfo(json);
        });
    }

}
