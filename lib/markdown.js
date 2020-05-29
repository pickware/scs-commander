const MarkdownIt = require('markdown-it');

module.exports = class Markdown {
    constructor(markdown) {
        this.markdown = markdown;
    }

    toString() {
        return this.markdown.trim();
    }

    toHtml() {
        const markDownIt = new MarkdownIt();

        return markDownIt.render(this.markdown.trim());
    }

    append(string) {
        this.markdown += string;
    }
};
