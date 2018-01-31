const notifier = require('node-notifier');

module.exports = {

    /**
     * @param {String} message
     */
    showGrowlIfEnabled(message) {
        if (parseInt(process.env.SCS_DISABLE_GROWL, 10)) {
            return;
        }

        notifier.notify({
            title: 'scs-commander',
            message,
        });
    },

    /**
     * @param {Array} elements
     * @param {Function} asyncFn
     * @param {Number} index (optional, default 0)
     */
    async sequentiallyAwaitEach(elements, asyncFn, index = 0) {
        await asyncFn(elements[index]);
        if ((index + 1) < elements.length) {
            await this.sequentiallyAwaitEach(elements, asyncFn, (index + 1));
        }
    },

};
