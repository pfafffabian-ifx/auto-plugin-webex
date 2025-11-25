# Webex Plugin

Post messages to Webex Teams after a release is made.

## Prerequisites

To post messages to Webex Teams you need the following secrets set in your environment:

- `WEBEX_TOKEN` - A Webex Bot token or Personal Access Token
- `WEBEX_ROOM_ID` - The ID of the Webex Teams room/space where messages should be posted

## Installation

This plugin is not included with the `auto` CLI installed via NPM. To install:

```bash
npm i --save-dev auto-webex-plugin
# or
yarn add -D auto-webex-plugin
```

## Usage

Configure the plugin in your auto configuration:

```json
{
  "plugins": [
    [
      "webex",
      {
        /* options */
      }
    ]
  ]
}
```

## Options

### Message

You can configure the message posted to Webex Teams. The `message` option should use the following special tokens to create a message.

- `%release` - The version bump (major, minor, patch)
- `%package` - The name of the package
- `%notes` - Your release notes
- `%link` - A link to your the release on GitHub
- `%version` - The latest version number

Default:

```txt
A new %release version of %package was released!

%notes

%link
```

Example configuration:

```json
{
  "plugins": [
    ["webex", { "message": "v%version of %package was released!

%link" }]
  ]
}
```

### Threshold

By default the `webex` plugin will only post if the version difference between the latest and the last release is greater than a `minor`.

```json
{
  "plugins": [["webex", { "threshold": "major" }]]
}
```
