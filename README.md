# scs-commander

[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat)](LICENSE) [![CI](https://github.com/pickware/scs-commander/actions/workflows/ci.yml/badge.svg)](https://github.com/pickware/scs-commander/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/scs-commander.svg?style=flat)](https://www.npmjs.com/package/scs-commander)

A CLI tool for managing plugins in the Shopware Community Store.

## Install

### Via npm

`npm install -g scs-commander`

### For development

Clone this repository and install it using `npm install && npm link`.

## Configuration

You can set your Shopware Community Store username and password in an environment configuration in your user's home directory (`~/.scs-commander`). This file is optional, so you can still pass the username via `-u` to each command and enter your password when asked. Also, even if `~/.scs-commander` exists and contains a username, you can overwrite it by passing the '-u' argument to the command.
Additionally you can set an optional HTTP webhook endpoint in the configuration file as well. This will call the endpoint upon a successful release. The URL supports basic auth and might look like this: `https://USERNAME:PASSWORD@domain.tld/endpoint`

See [`.scs-commander.dist`](https://github.com/VIISON/scs-commander/blob/master/.scs-commander.dist) for further info.

## Usage

### List all available plugins

`scs-commander list -u <your_username>`

You can sort the results by passing option `-s <sort_field>`. The available sort fields are `name`, `version`, `active`, `reviewStatus` and `shopwareCompatibility`. By default only active plugins are listed. If you wish to list all plugins of the account pass `--show-all`.

### Update the description of a plugin

`scs-commander description -u <your_username> -p <technical_plugin_name> -l <locale> [--backup] [--patch] [--max-update-retries <retry-count>] <path_to_description_file>`

By default this command reads the file from the provided path and uses its content to update the plugin description in the community store. If you wish to review the resulting changes first and manually confirm them, pass `--patch`. You can also pass `--backup` to back up the current description in the local file system. Since Shopware sometimes randomly returns errors when trying to save a plugin description, you can optionally pass `--max-update-retries <retry-count>` to automatically retry the upload requests on failure.

### Upload a new version of a plugin

**Remark:** You can only upload plugin `.zip` files, which contain a valid `plugin.json` file next to the plugin `Bootstrap.php` (see [shopwareLabs/plugin-info](https://github.com/shopwareLabs/plugin-info) for more info).

`scs-commander upload -u <your_username> <path_to_plugin_zip_file>`

By default, this command automatically requests a review of the uploaded plugin version, which causes the binary to be released automatically. If you only want to upload the binary, pass the `--no_release` or `-R` option.
If set, the HTTP endpoint will get called after a successful release.

**Note:** Releasing a plugin binary makes only sense when providing a changelog for all available languages, since Shopware requires a changelog of at least 20 characters per supported language. The changelog is parsed directly from a `CHANGELOG.md` file that must be contained in the `.zip` file. The benefit of using a separate `CHANGELOG.md` file is readability, which is why defining a changelog in the `plugin.json` file is not supported. Currently the [changelog parser](https://github.com/VIISON/scs-commander/blob/master/lib/plugin_changelog_parser.js) supports only a simple structure:

```
## <version_0>

### <language_A, e.g. 'de'>

The changelog content of 'version_0' in 'language_A'. Can contain any markdown except for '##' and '###' headlines.

### <language_B, e.g. 'en'>

The changelog content of 'version_0' in 'language_B'.

## <version_1>

### <language_A, e.g. 'de'>

The changelog content of 'version_1' in 'language_A'.

[...]
```

Changelog markdown is compiled to HTML, which is used as the changelog in the store. This makes it easy to add (nested) lists, links and simple formatting (bold, italic etc.) to your plugin changelogs in the community store (and it looks nice in your GitHub repositories too). The order of versions or languages within a version is arbitrary.

### Print the changelog of a plugin

`scs-commander changelog -l <language, e.g. "en"> <path_to_plugin_zip_file>`

You can also get complied HTML (which is the same as used by the `upload` command) by setting `--html`. If no `language` is provided, the english changelog is returned.

### Change the minimum Shopware version compatibility of a plugin

`scs-commander compatibility -u <your_username> -p <technical_plugin_name> --min-version <shopware_version_string>`

### Download and dump the plugin information

`scs-commander dump-plugin -u <your_username> -p <technical_plugin_name> [-f <FORMAT>]`

Currently the only supported output format is `json`.

## License

[MIT](https://github.com/VIISON/scs-commander/blob/master/LICENSE)
