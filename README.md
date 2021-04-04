
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge Sky Q Tv Accessory
Accessory for SKY Q which adds it to the Home app as a Set-Top Box with the ability to use the Control Centre remote functionality.

## Installation

Option 1: Install the plugin via [config-ui-x](https://github.com/oznu/homebridge-config-ui-x):
- Search for Sky Q TV Remote on config-ui-x plugin screen
- Click Install on homebridge Dyson Pure Cool plugin
- Once installed you will be prompted to set the config
- Restart homebridge service and plugin should be loaded with accessories

Option 2: Install the plugin via npm:

```bash
npm install homebridge-skyq-tvremote -g
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

#### Note: If you rename one of the boxes via the UI or in the config it will need to be removed and added back into the Home app

## Add Sky Q box to the Home app

There is a homekit limitation that allows only one Set-Top box per bridge. Therefore each Sky Q box will be exposed as external accessory and will not show up when only the homebridge-bridge was added. To add each Sky Q box:

1. Open the Home App
1. Type `+` in the top right corner to add a device
1. Then click on **Don't Have a Code or Can't scan?**
1. The found TV should appear under **Nearby Accessories** ... click on it
1. Use the PIN that is set in **config.json** under `config > bridge > pin`

## Getting the Sky Q Box IP address

On your Sky Q Box, go to:

Settings -> Setup -> Network -> Advanced Settings -> IP address

If you dont reserve an IP address on your router via the DHCP settings then it may get a differnt IP if you restart your router and this will cause the plugin to fail.
