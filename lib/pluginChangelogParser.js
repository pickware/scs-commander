const fs = require('mz/fs');
const JSZip = require('jszip');
const marked = require('marked');

module.exports = class PluginChangelogParser {

    /**
     * @param {boolean} compileHTML (optional)
     */
    constructor(compileHTML) {
        this.compileHTML = compileHTML === true;
    }

    /**
     * @param {String} filePath
     * @return {Object}
     */
    async readZip(filePath) {
        const exists = await fs.exists(filePath);

        if (!exists) {
            throw new Error(`File ${filePath} does not exist`);
        }

        const data = await fs.readFile(filePath);
        const zip = await JSZip.loadAsync(data);
        // Locate the CHANGELOG.md file
        const changelogFile = Object.keys(zip.files).find(
            key => key.match(/(Backend|Core|Frontend)\/[^/]+\/CHANGELOG\.md/)
        );

        let rawChangelog = '';
        if (changelogFile) {
            rawChangelog = await zip.file(changelogFile).async('string');
        }

        const versions = {};
        // Parse the markdown file
        let currentVersion;
        let currentLocale;
        rawChangelog.split('\n').map(line => line.trim()).forEach((line) => {
            if (line.search(/^##[^#]+/) !== -1) {
                // New version
                currentVersion = line.substr(2).trim();
                currentLocale = null;
                versions[currentVersion] = {};
            } else if (line.search(/^###[^#]+/) !== -1) {
                // New locale
                currentLocale = line.substr(3).trim();
                if (!currentVersion) {
                    throw new Error(
                        `Found new locale section ${currentLocale} without an enclosing version header`
                    );
                }
                if (versions[currentVersion][currentLocale]) {
                    throw new Error(`Locale ${currentLocale} was declared twice for version ${currentVersion}`);
                }
                versions[currentVersion][currentLocale] = '';
            } else if (currentLocale) {
                // Just add the line to the current version/locale pair
                versions[currentVersion][currentLocale] += `\n${line}`;
            }
        });

        // Sort the parsed changelog  by locale, version
        const changelog = {};
        Object.keys(versions).forEach((version) => {
            Object.keys(versions[version]).forEach((locale) => {
                let content = versions[version][locale];
                // Remove leading and trailing whitespace (incl. newlines)
                content = content.replace(/^\s+|\s+$/g, '');
                if (content.length === 0) {
                    return;
                }

                if (this.compileHTML) {
                    // Generate HTML from the content
                    content = marked(content, {
                        sanitize: true,
                    });
                }
                changelog[locale] = changelog[locale] || {};
                changelog[locale][version] = content;
            });
        });

        return changelog;
    }

};
