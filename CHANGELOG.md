## 3.1.0

* Enables support for Node.js > v14.

## 3.0.2

* Increase maximum file size for plugin binary uploads to 30MB.

## 3.0.1

* Fixes usages of options passed to any command.

## 3.0.0

### Breaking changes

* Drops support of Node.js < v14.

### Bug fixes

* Fixes loading of extra plugin fields.
* Fixes `upload` command.

## 2.2.0

* Adds compatibility with Showpare's 4-digit version numbers.

## 2.1.0

* Adds support for nested lists in changelog markdown.

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
