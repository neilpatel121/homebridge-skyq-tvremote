<p align="center">

<img src="https://raw.githubusercontent.com/neilpatel121/homebridge-skyq-tvremote/main/branding/logo.png" height="150">

</p>

# Homebridge Sky Q Set-Top Plugin

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
        "name": "Sky Q TV Remote",
        "platform": "skyq-tvremote",
        "devices": [
            {
                "name": "Sky Q TV",
                "ipaddress": "192.168.0.2"
            },
            {
                "name": "Sky Q Mini 1",
                "ipaddress": "192.168.0.3"
            },
            {
                "name": "Sky Q Mini 2",
                "ipaddress": "192.168.0.4"
            }
        ]
    }
]
```

**name**: The Name of your Sky Q set-top box in the Home app.

**ipaddress**: Local IP address of the Sky Q set-top box.

**Note:** *If you rename one of the boxes via the UI or in the configuration it will need to be removed and added back into the Home app.*

## Adding Sky Q set-top box to the Home app

Sky Q set-top boxes are exposed to HomeKit as separate accessories and each needs to be manually paired.

1. Open the Home <img src='https://user-images.githubusercontent.com/3979615/78010622-4ea1d380-738e-11ea-8a17-e6a465eeec35.png' height='16.42px'> app on your device.
2. Tap the Home tab, then tap <img src='https://user-images.githubusercontent.com/3979615/78010869-9aed1380-738e-11ea-9644-9f46b3633026.png' height='16.42px'>.
3. Tap *Add Accessory*, and select *I Don't Have a Code or Cannot Scan*.
4. Enter the Homebridge PIN, this can be found under the QR code in Homebridge UI or your Homebridge logs, alternatively you can select *Use Camera* and scan the QR code again.

## Getting the Sky Q set-top box IP address

On your Sky Q set-top box, go to:

`Settings` > `Setup` > `Network` > `Advanced Settings` > `IP address`

**Note:** *If you dont reserve an IP address on your router via the DHCP settings then it may get a different IP if you restart your router and this will cause the plugin to fail.*

## Changing the inputs of the Sky Q set-top box

On your Sky Q set-top box, set your favourite inputs.
