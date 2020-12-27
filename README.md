
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge Sky Q Tv Accessory

The first TV Accerssory for SKY Q

Setup Example Config:

"platforms": [
        {
            "name": "Sky Q TV",
            "platform": "homebridge-skyq-tvremote",
            "ipaddress": "192.168.0.229"
        },
        {
            "name": "Sky Q Mini",
            "platform": "homebridge-skyq-tvremote",
            "ipaddress": "192.168.0.238"
        }
    ]
