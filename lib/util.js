'use strict';

const notifier = require('node-notifier');

module.exports = {

    /**
     * @param {String} message
     */
    showGrowlIfEnabled(message) {
        if (parseInt(process.env['SCS_DISABLE_GROWL'])) {
            return;
        }

        notifier.notify({
          title: 'scs-commander',
          message: message
        });
    }

}
