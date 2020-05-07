const marked = require('marked');
const { parseChangelogMarkdown } = require('./changelogMarkdownParser');

module.exports = class Changelog {
    constructor(markdown) {
        this.markdown = markdown;
    }

    filterBy({ locale, version }) {
        const parsedChangelog = parseChangelogMarkdown(this.markdown);

        return new Changelog(parsedChangelog[version][locale]);
    }

    toMarkdown() {
        return this.markdown;
    }

    toHtml() {
        return marked(this.markdown);
    }
};
