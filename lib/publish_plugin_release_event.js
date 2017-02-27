const Request = require('superagent');
const Program = require('commander');
const Chalk = require('chalk');

module.exports = function publishPluginReleaseEvent(pluginInfo) {
  if (typeof Program.releaseEventURL !== 'undefined') {
    return Request
      .post(Program.releaseEventURL)
      .send({
        pluginName: pluginInfo.getName(),
        pluginVersion: pluginInfo.getCurrentVersion(),
        pluginLabel: {
          de: pluginInfo.getLabel('de'),
          en: pluginInfo.getLabel('en'),
        },
        pluginChangelog: {
          de: pluginInfo.getChangelog('de', null),
          en: pluginInfo.getChangelog('en', null),
        },
      })
      .then((res) => {
        if (res.ok) {
          console.log(Chalk.green.bold('Publish release event succeeded'));
        } else {
          throw new Error(`Unexpected status code: ${res.statusCode}`);
        }
      })
      .catch((err) => {
        console.log(Chalk.red.bold(`Publish release event failed: ${err.message}`));
      });
  }
};
