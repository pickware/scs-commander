## 2.0.1

* Fixes evaluation of Shopware version compatibility constraints for Shopware 5 plugins.

## 2.0.0

* Makes commands `changelog` and `upload` compatible with Shopware 6 plugins.
* Makes command `compatibility` fail when executed for a Shopware 6 plugin.
* Fixes a bug in command `dump-plugin` that lead to a crash when trying to dump a plugin that does not exist.
* Removes methods:
  * `ShopwareStoreCommander.getSalesForPlugin`
  * `ShopwareStoreCommander.getCommissionsForPlugin`
* Removes files:
  * `lib/pluginChangelogParser.js`
  * `lib/pluginInfo.js`
  * `lib/pluginJsonReader.js`
