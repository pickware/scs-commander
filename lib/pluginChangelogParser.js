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
        if (!changelogFile) {
            throw new Error('ZIP file does not contain a CHANGELOG.md');
        }

        const rawChangelog = await zip.file(changelogFile).async('string');

        // Parse the markdown file
        const changelog = {};
        let currentVersion;
        let currentLocale;
        rawChangelog.split('\n').map(line => line.trim()).forEach((line) => {
            if (line.search(/^##[^#]+/) !== -1) {
                // New version
                currentVersion = line.substr(2).trim();
                currentLocale = null;
                changelog[currentVersion] = {};
            } else if (line.search(/^###[^#]+/) !== -1) {
                // New locale
                currentLocale = line.substr(3).trim();
                if (!currentVersion) {
                    throw new Error(`Found new locale section ${currentLocale} without an enclosing version header`);
                }
                if (changelog[currentVersion][currentLocale]) {
                    throw new Error(`Locale ${currentLocale} was declared twice for version ${currentVersion}`);
                }
                changelog[currentVersion][currentLocale] = '';
            } else if (currentLocale) {
                // Just add the line to the current version/locale pair
                changelog[currentVersion][currentLocale] += `\n${line}`;
            }
        });

        // Clean changelog per version, locale
        Object.keys(changelog).forEach((version) => {
            Object.keys(changelog[version]).forEach((locale) => {
                let content = changelog[version][locale];
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

                changelog[version][locale] = content;
            });
        });

        return changelog;
    }

};
