<p align="center">

<img src="https://github.com/neilpatel121/homebridge-skyq-tvremote/raw/main/branding/logo.png" height="150">

</p>

# Homebridge Sky Q TV Plugin

Plugin for Sky Q which adds it to the Home app as a set-top box with the ability to use the control centre remote functionality.

## Installation

Install using the [Homebridge UI](https://github.com/oznu/homebridge-config-ui-x), or the same way you installed Homebridge - as a global NPM module. For example:

```shell
sudo npm install -g homebridge-skyq-tvremote
```

## Configuration

```json
"platforms": [
    {
        "name": "Sky Q TV",
        "platform": "skyq-tvremote",
        "devices": [
            {
                "name": "Sky Q TV",
                "ipaddress": "192.xxx.x.1"
            },
            {
                "name": "Sky Q Mini",
                "ipaddress": "192.xxx.x.2"
            },
            {
                "name": "Sky Q Mini 2",
                "ipaddress": "192.xxx.x.3"
            }
        ]
    }
]
```

**name**: The Name of your Sky Q box in the Home app

**ipaddress**: Local IP address of the device

**Note:** *If you rename one of the boxes via the UI or in the configuration it will need to be removed and added back into the Home app.*

## Adding Sky Q box to the Home app

There is a HomeKit limitation that allows only one set-top box per bridge. Therefore each Sky Q box will be exposed as an external accessory and will not show up when only the Homebridge was added. To add each Sky Q box:

1. Open the Home <img src="https://user-images.githubusercontent.com/3979615/78010622-4ea1d380-738e-11ea-8a17-e6a465eeec35.png" height="16.42px"> app on your device.
2. Tap the Home tab, then tap <img src="https://user-images.githubusercontent.com/3979615/78010869-9aed1380-738e-11ea-9644-9f46b3633026.png" height="16.42px">.
3. Tap Add Accessory, then click on `I Don't Have a Code or Cannot Scan`.
4. The found TV should appear under `Nearby Accessories`… click on it.
5. Use the PIN that is set in your `config.json` under `bridge`> `pin`.

## Getting the Sky Q Box IP address

On your Sky Q Box, go to:

`Settings` > `Setup` > `Network` > `Advanced Settings` > `IP address`

**Note:** *If you dont reserve an IP address on your router via the DHCP settings then it may get a differnt IP if you restart your router and this will cause the plugin to fail.*
