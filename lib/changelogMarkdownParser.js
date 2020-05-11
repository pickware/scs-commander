function parseChangelogMarkdown(markdown) {
    const changelog = {};
    let currentVersion;
    let currentLocale;
    markdown.split('\n').map(line => line.trim()).forEach((line) => {
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

            changelog[version][locale] = content;
        });
    });

    return changelog;
}

module.exports = { parseChangelogMarkdown };
