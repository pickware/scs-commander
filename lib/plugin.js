const fs = require('mz/fs');
const JSZip = require('jszip');
const path = require('path');
const { parseChangelogMarkdown } = require('./changelogMarkdownParser');
const composerSemver = require('./composerSemver');

function readInfoFromComposerJson(composerJsonString) {
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

function readInfoFromPluginJson(pluginJsonString) {
    const pluginJson = JSON.parse(pluginJsonString);
    const minimumVersion = pluginJson.compatibility.minimumVersion || '0.0.0';
    const maximumVersion = pluginJson.compatibility.maximumVersion || '99.99.99';

    return {
        version: pluginJson.currentVersion,
        shopwareCompatibility: `${minimumVersion} - ${maximumVersion}`,
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

        const sw5RootDirectory = zip.folder(/^(Backend|Frontend|Core)\/\w+\//)[0];
        const sw6RootDirectory = zip.folder(/^\w+\//)[0];

        const plugin = new Plugin();
        let rootDirectory;
        if (sw5RootDirectory) {
            rootDirectory = sw5RootDirectory.name;
            plugin.technicalName = rootDirectory.split('/')[1];
            plugin.shopwareMajorVersion = 5;
            Object.assign(plugin, readInfoFromPluginJson(
                await zip.file(path.join(rootDirectory, 'plugin.json')).async('string'),
            ));
        } else if (sw6RootDirectory) {
            rootDirectory = sw6RootDirectory.name;
            plugin.technicalName = rootDirectory.split('/')[0];
            plugin.shopwareMajorVersion = 6;
            Object.assign(plugin, readInfoFromComposerJson(
                await zip.file(path.join(rootDirectory, 'composer.json')).async('string'),
            ));
        } else {
            throw new Error('Could not detect whether plugin targets Shopware 5 or Shopware 6.');
        }

        const parsedChangelog = parseChangelogMarkdown(
            await zip.file(path.join(rootDirectory, 'CHANGELOG.md')).async('string'),
        );
        plugin.releaseNotes = parsedChangelog[plugin.version];

        return plugin;
    }

    isCompatibleWithShopwareVersion(shopwareVersion) {
        // Composer does not understand the Shopware-custom postfixes (EA and DP).
        if (/-(EA|DP)/.test(shopwareVersion)) {
            return false;
        }

        return composerSemver.satisfies(shopwareVersion, this.shopwareCompatibility);
    }
};
