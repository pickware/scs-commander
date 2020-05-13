const marked = require('marked');

module.exports = class Markdown {
    constructor(markdown) {
        this.markdown = markdown;
    }

    toString() {
        return this.markdown;
    }

    toHtml() {
        return marked(this.markdown);
    }
};
