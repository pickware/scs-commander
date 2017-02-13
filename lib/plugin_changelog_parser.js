'use strict';

const fs = require('mz/fs');
const JSZip = require('jszip');
const path = require('path');
const marked = require('marked');

module.exports = class PluginChangelogParser {

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
            // Locate the CHANGELOG.md file
            const changelogFile = Object.keys(zip.files).find(key => {
                return key.match(/(Backend|Core|Frontend)\/[^\/]+\/CHANGELOG\.md/);
            });
            if (!changelogFile) {
                return null;
            }

            return zip.file(changelogFile).async('string');
        }).then(rawChangelog => {
            const versions = {};
            // Parse the markdown file
            let currentVersion,
                currentLocale;
            rawChangelog.split('\n').map(line => {
                return line.trim();
            }).forEach(line => {
                if (line.search(/^##[^#]+/) !== -1) {
                    // New version
                    currentVersion = line.substr(2).trim();
                    currentLocale = null;
                    versions[currentVersion] = {};
                } else if (line.search(/^###[^#]+/) !== -1) {
                    // New locale
                    currentLocale = line.substr(3).trim();
                    if (!currentVersion) {
                        throw new Error(`Found new locale section ${currentLocale} without an enclosing version header`);
                    }
                    if (versions[currentVersion][currentLocale]) {
                        throw new Error(`Locale ${currentLocale} was declared twice for version ${currentVersion}`);
                    }
                    versions[currentVersion][currentLocale] = '';
                } else if (currentLocale) {
                    // Just add the line to the current version/locale pair
                    versions[currentVersion][currentLocale] += '\n' + line;
                }
            });

            // Convert the parsed markdown to HTML and sort the changelog by locale>version
            const changelog = {};
            Object.keys(versions).forEach(version => {
                Object.keys(versions[version]).forEach(locale => {
                    let content = versions[version][locale];
                    // Remove leading and trailing whitespace (incl. newlines)
                    content = content.replace(/^\s+|\s+$/g, '');
                    if (content.length == 0) {
                        return;
                    }

                    // Generate HTML from the content
                    changelog[locale] = changelog[locale] || {};
                    changelog[locale][version] = marked(content, {
                        sanitize: true
                    });
                });
            });

            return changelog;
        });
    }

}
