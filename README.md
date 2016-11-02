# scs-commander

[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE)

A CLI tool for managing plugins in the Shopware Community Store.

## Install

For now you have to pull this repository or download the source and install it using `npm install && npm link`.

## Configuration

You can set your Shopware Community Store username and password in an environment configuration in your user's home directory (`~/.scs-commaner`). This file is optional, so you can still pass the username via `-u` to each command and enter your password when asked. Also, even if `~/.scs-commaner` exists and contains a username, you can overwrite it by passing the '-u' argument to the command.

See [`.scs-commaner.dist`](https://github.com/VIISON/scs-commander/blob/master/.scs-commaner.dist) for further info.

## Usage

### List all available plugins

`scs-commander list -u <your_username>`

You can sort the results by passing option `-s <sort_field>`. The available sort fields are `name`, `version`, `active` and `reviewStatus`.

### Update the description of a plugin

`scs-commander description -u <your_username> -p <technical_plugin_name> <path_to_description_file>`

### Upload a new version of a plugin

**Remark:** You can only upload plugin `.zip` files, which contain a valid `plugin.json` file next to the plugin `Bootstrap.php` (see [shopwareLabs/plugin-info](https://github.com/shopwareLabs/plugin-info) for more info).

`scs-commander upload -u <your_username> <path_to_plugin_zip_file>`

To release an uploaded plugin version by requesting a review, pass the `--release` option.

## License

MIT
