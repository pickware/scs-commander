## next major release

* Makes commands `changelog` and `upload` compatible with Shopware 6 plugins.
* Makes the command `compatibility` fail when executed for a Shopware 6 plugin.
* Fixes a bug that lead to a crash when trying to dump a plugin that does not exist.
* Removes methods:
  * `ShopwareStoreCommander.getSalesForPlugin`
  * `ShopwareStoreCommander.getCommissionsForPlugin`
* Removes files:
  * `lib/pluginChangelogParser.js`
  * `lib/pluginInfo.js`
  * `lib/pluginJsonReader.js`