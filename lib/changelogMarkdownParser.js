const Markdown = require('./markdown');

function parseChangelogMarkdown(markdown) {
    const changelog = {};
    let currentVersion;
    let currentLocale;
    markdown.split('\n').forEach((line) => {
        if (line.search(/^ {0,3}##[^#]+/) !== -1) {
            // New version
            currentVersion = line.trim().substr(2).trim();
            currentLocale = null;
            changelog[currentVersion] = {};
        } else if (line.search(/^ {0,3}###[^#]+/) !== -1) {
            // New locale
            currentLocale = line.trim().substr(3).trim();
            if (!currentVersion) {
                throw new Error(`Found new locale section ${currentLocale} without an enclosing version header`);
            }
            if (changelog[currentVersion][currentLocale]) {
                throw new Error(`Locale ${currentLocale} was declared twice for version ${currentVersion}`);
            }
            changelog[currentVersion][currentLocale] = new Markdown('');
        } else if (currentLocale) {
            // Just add the line to the current version/locale pair
            changelog[currentVersion][currentLocale].append(`\n${line}`);
        }
    });

    console.log(changelog);

    return changelog;
}

module.exports = { parseChangelogMarkdown };
