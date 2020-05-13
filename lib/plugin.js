const fs = require('mz/fs');
const JSZip = require('jszip');
const path = require('path');
const semver = require('semver');
const Changelog = require('./changelog');

function readInfosFromComposerJson(composerJsonString) {
    const composerJson = JSON.parse(composerJsonString);

    return {
        version: composerJson.version,
        shopwareCompatibility: composerJson.require['shopware/core'],
        label: {
            en: composerJson.extra.label['en-GB'],
            de: composerJson.extra.label['de-DE'],
        },
    };
}

function readInfosFromPluginJson(pluginJsonString) {
    const pluginJson = JSON.parse(pluginJsonString);
    const compatibility = pluginJson.compatibility;

    return {
        version: pluginJson.currentVersion,
        shopwareCompatibility: `>= ${compatibility.minimumVersion} && <= ${compatibility.maximumVersion}`,
        label: pluginJson.label,
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
            Object.assign(plugin, readInfosFromPluginJson(
                await zip.file(path.join(rootDir, 'plugin.json')).async('string'),
            ));
        } else if (sw6RootFolder) {
            rootDir = sw6RootFolder.name;
            plugin.technicalName = rootDir.split('/')[0];
            plugin.shopwareMajorVersion = 6;
            Object.assign(plugin, readInfosFromComposerJson(
                await zip.file(path.join(rootDir, 'composer.json')).async('string'),
            ));
        } else {
            throw new Error('Could not detect whether it is a plugin for Shopware 5 or 6.');
        }

        plugin.changelog = new Changelog(
            await zip.file(path.join(rootDir, 'CHANGELOG.md')).async('string'),
        );

        return plugin;
    }

    isCompatibleWith(shopwareVersion) {
        return semver.satisfies(shopwareVersion, this.shopwareCompatibility);
    }
};
