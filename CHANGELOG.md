## next major release

* Makes command "changelog" compatible with Shopware 6 plugins.
* Makes the command "compatibility" fail when executed for a Shopware 6 plugin.
* Fixes a bug that lead to a crash when trying to dump a plugin that does not exist.
* Removes methods:
  * `ShopwareStoreCommander.getSalesForPlugin`
  * `ShopwareStoreCommander.getCommissionsForPlugin`
