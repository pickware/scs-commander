const marked = require('marked');

module.exports = class Markdown {
    constructor(markdown) {
        this.markdown = markdown;
    }

    toString() {
        return this.markdown.trim();
    }

    toHtml() {
        return marked(this.markdown.trim());
    }

    append(string) {
        this.markdown += string;
    }
};
