const fs = require('mz/fs');
const JSZip = require('jszip');
const path = require('path');
const semver = require('semver');
const Changelog = require('./changelog');

function readPluginInfoFromComposerJson(composerJsonString) {
    const composerJson = JSON.parse(composerJsonString);

    return {
        version: composerJson.version,
        shopwareCompatibility: composerJson.require['shopware/core'],
    };
}

function readPluginInfoFromPluginJson(pluginJsonString) {
    const pluginJson = JSON.parse(pluginJsonString);
    const compatibility = pluginJson.compatibility;

    return {
        version: pluginJson.currentVersion,
        shopwareCompatibility: `>= ${compatibility.minimumVersion} && <= ${compatibility.maximumVersion}`,
    };
}

module.exports = class Plugin {
    static async readFromZipFile(zipFilePath) {
        if (!await fs.exists(zipFilePath)) {
            throw new Error(`File ${zipFilePath} does not exist`);
        }

        const data = await fs.readFile(zipFilePath);
        const zip = await JSZip.loadAsync(data);

        const plugin = new Plugin();
        const sw5RootFolder = zip.folder(
            /^(Backend|Frontend|Core)\/\w+\//,
        )[0];
        const sw6RootFolder = zip.folder(
            /^\w+\//,
        )[0];

        let rootDir;
        if (sw5RootFolder) {
            rootDir = sw5RootFolder.name;
            plugin.technicalName = rootDir.split('/')[1];
            plugin.shopwareMajorVersion = 5;
            plugin.info = readPluginInfoFromPluginJson(
                await zip.file(path.join(rootDir, 'plugin.json')).async('string'),
            );
        } else if (sw6RootFolder) {
            rootDir = sw6RootFolder.name;
            plugin.name = rootDir.split('/')[0];
            plugin.shopwareMajorVersion = 6;
            plugin.info = readPluginInfoFromComposerJson(
                await zip.file(path.join(rootDir, 'composer.json')).async('string'),
            );
        } else {
            throw new Error('Could not detect, whether it is a Plugin for Shopware 5 or 6.');
        }

        plugin.changelog = new Changelog(
            await zip.file(path.join(rootDir, 'CHANGELOG.md')).async('string'),
        );

        console.log(plugin);

        return plugin;
    }

    isCompatibleWith(shopwareVersion) {
        return semver.satisfies(shopwareVersion, this.info.shopwareCompatibility);
    }
};
