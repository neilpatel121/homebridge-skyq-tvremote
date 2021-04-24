import {
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  IndependentPlatformPlugin,
  Logging,
  PlatformConfig,
} from 'homebridge';

import { PLUGIN_NAME } from './settings';

import SkyRemote = require('sky-remote');
import SkyQCheck = require('sky-q');

type ActiveCharacterstic = HAP['Characteristic']['Active']['INACTIVE'] | HAP['Characteristic']['Active']['ACTIVE'];

interface SkyTVDeviceConfig {
  name?: string;
  ipAddress?: string;
}

interface SkyTVConfig extends PlatformConfig, SkyTVDeviceConfig {
  devices?: SkyTVDeviceConfig[];
}

export class SkyTVPlugin implements IndependentPlatformPlugin {

  private readonly log: Logging;
  private readonly api: API;

  private names: string[] = [];

  constructor(log: Logging, config: SkyTVConfig, api: API) {
    this.log = log;
    this.api = api;

    if (config.devices) {
      config.devices.forEach((deviceConfig, key) => {
        deviceConfig = this.prepareDeviceConfig(key, deviceConfig);

        this.publishExternalAccessory(deviceConfig);
        this.names = [];
      });
    } else {
      const deviceConfig = this.prepareDeviceConfig(null, config);

      this.publishExternalAccessory(deviceConfig);
    }

    log.info('Sky TV platform finished initializing!');
  }

  prepareDeviceConfig(key: number | null, config: SkyTVDeviceConfig): SkyTVDeviceConfig {
    if (!config.name) {
      if (key === null) {
        config.name = 'TV';
      } else {
        config.name = `TV ${key + 1}`;

        if (this.names.includes(config.name)) {
          this.log.error(`Duplicate name at device ${key + 1}.`);
        }
      }
    }

    if (!config.ipAddress) {
      if (key === null) {
        if (!config.ipAddress) {
          this.log.error('IP address not set.');
        }
      } else {
        if (!config.ipAddress) {
          this.log.error(`IP address not set at device ${key + 1}.`);
        }
      }
    }

    return config;
  }

  publishExternalAccessory(config: SkyTVDeviceConfig) {
    if (!config.name) {
      return;
    }
    if (!config.ipAddress) {
      return;
    }

    const remoteControl = new SkyRemote(config.ipAddress);
    const boxCheck = new SkyQCheck({ ip: config.ipAddress });

    let activeState: ActiveCharacterstic = this.api.hap.Characteristic.Active.INACTIVE;

    boxCheck.getPowerState().then(isOn => {
      if (isOn) {
        activeState = this.api.hap.Characteristic.Active.ACTIVE;
        this.log(`[${config.name}]`, 'Sky box is on');
      } else {
        activeState = this.api.hap.Characteristic.Active.INACTIVE;
        this.log(`[${config.name}]`, 'The sky box is in standby');
      }
    }).catch(error => {
      this.log.error(`[${config.name}]`, 'Perhaps looking at this error will help you figure out why');
      this.log.error(error);
    });

    // Generate a UUID
    const uuid = this.api.hap.uuid.generate(`homebridge:${PLUGIN_NAME}:` + config.ipAddress);

    // Create the accessory
    const accessory = new this.api.platformAccessory(config.name, uuid);

    // Set the accessory category
    accessory.category = this.api.hap.Categories.TV_SET_TOP_BOX;

    // Add the accessory information service
    const accessoryInfoService = accessory.getService(this.api.hap.Service.AccessoryInformation)!;
    accessoryInfoService.setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Sky');

    boxCheck._getSystemInformation({}).then(info => {
      if (info.manufacturer) {
        accessoryInfoService.setCharacteristic(this.api.hap.Characteristic.Manufacturer, info.manufacturer);
      }
      
      if (info.deviceType) {
        accessoryInfoService.setCharacteristic(this.api.hap.Characteristic.Model, info.deviceType);
      }

      if (info.serialNumber) {
        accessoryInfoService.setCharacteristic(this.api.hap.Characteristic.SerialNumber, info.serialNumber);
      }
    });

    // Add the TV service
    const tvService = accessory.addService(this.api.hap.Service.Television);

    // Set the TV name
    tvService.setCharacteristic(this.api.hap.Characteristic.ConfiguredName, config.name);

    // Set sleep discovery characteristic
    tvService.setCharacteristic(
      this.api.hap.Characteristic.SleepDiscoveryMode,
      this.api.hap.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
    );

    boxCheck._request('as/services').then(data => {
      if (data.services) {
        data.services.forEach(service => {
          if (!service.t) return;

          const inputService = accessory.addService(this.api.hap.Service.InputSource);
          inputService.setCharacteristic(this.api.hap.Characteristic.ConfiguredName, service.t);
          inputService.setCharacteristic(this.api.hap.Characteristic.IsConfigured, this.api.hap.Characteristic.IsConfigured.CONFIGURED);
          inputService.setCharacteristic(this.api.hap.Characteristic.InputSourceType, this.api.hap.Characteristic.InputSourceType.TUNER);
          inputService.setCharacteristic(this.api.hap.Characteristic.InputDeviceType, this.api.hap.Characteristic.InputSourceType.TUNER);

          if (service.c) {
            inputService.setCharacteristic(this.api.hap.Characteristic.Identifier, service.c);
          }

          tvService.addLinkedService(inputService);
        });
      }
    });

    // Handle on / off events using the active characteristic
    tvService.getCharacteristic(this.api.hap.Characteristic.Active)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this.log.info(`[${config.name}]`, 'Get Active: ' + (activeState ? 'ACTIVE': 'INACTIVE'));
        callback(undefined, activeState);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (!!value === !!activeState) {
          this.log.info(`[${config.name}]`, 'Skipping Active: new value is equal to current value');
          return callback();
        }

        this.log.info(`[${config.name}]`, 'Set Active: ' + (value ? 'ACTIVE': 'INACTIVE'));

        this.send(remoteControl, 'power').then(() => {
          activeState = value ? this.api.hap.Characteristic.Active.ACTIVE : this.api.hap.Characteristic.Active.INACTIVE;
          tvService.updateCharacteristic(this.api.hap.Characteristic.Active, activeState);
          callback();
        }).catch((error) => {
          this.log.error(error);
          callback(error);
        });
      },
      );

    // Handle remote control input
    tvService.getCharacteristic(this.api.hap.Characteristic.RemoteKey)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const command: string | undefined = (() => {
          switch (value) {
            case this.api.hap.Characteristic.RemoteKey.REWIND:
              return 'rewind';
            case this.api.hap.Characteristic.RemoteKey.FAST_FORWARD:
              return 'fastforward';
            case this.api.hap.Characteristic.RemoteKey.ARROW_UP:
              return 'up';
            case this.api.hap.Characteristic.RemoteKey.ARROW_DOWN:
              return 'down';
            case this.api.hap.Characteristic.RemoteKey.ARROW_LEFT:
              return 'left';
            case this.api.hap.Characteristic.RemoteKey.ARROW_RIGHT:
              return 'right';
            case this.api.hap.Characteristic.RemoteKey.SELECT:
              return 'select';
            case this.api.hap.Characteristic.RemoteKey.BACK:
              return 'backup';
            case this.api.hap.Characteristic.RemoteKey.PLAY_PAUSE:
              return 'play';
            case this.api.hap.Characteristic.RemoteKey.INFORMATION:
              return 'tvguide';
            case this.api.hap.Characteristic.RemoteKey.EXIT:
          }
        })();

        if (!command) {
          this.log.error(`[${config.name}]`, `Skipping Remote Key: unknown new value: ${value}`);
          return callback();
        }
        
        this.log.info(`[${config.name}]`, 'Set Remote Key: ' + command);
        this.send(remoteControl, command).then(() => callback()).catch((error) => {
          this.log.error(error);
          callback(error);
        });
      },
      );

    // Add the speaker service
    const speakerService = accessory.addService(this.api.hap.Service.TelevisionSpeaker);
    speakerService.setCharacteristic(this.api.hap.Characteristic.Active, this.api.hap.Characteristic.Active.ACTIVE);
    speakerService.setCharacteristic(this.api.hap.Characteristic.VolumeControlType, this.api.hap.Characteristic.VolumeControlType.RELATIVE);

    // Handle volume control
    speakerService.getCharacteristic(this.api.hap.Characteristic.VolumeSelector)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const command = (() => {
          switch (value) {
            case this.api.hap.Characteristic.VolumeSelector.INCREMENT:
              return 'channelup';
            case this.api.hap.Characteristic.VolumeSelector.DECREMENT:
              return 'channeldown';
          }
        })();

        if (!command) {
          this.log.error(`[${config.name}]`, `Skipping Volume Selector: unknown newValue: ${value}`);
          return callback();
        }
        
        this.log.info(`[${config.name}]`, 'Set Volume Selector: ' + command);
        this.send(remoteControl, command).then(() => callback()).catch((error) => {
          this.log.error(error);
          callback(error);
        });
      },
      );

    // will be exposed as an additional accessory and must be paired separately with the pincode of homebridge
    this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
  }

  send = async (remoteControl: SkyRemote, command: string) => {
    try {
      remoteControl.press(command);
    } catch (error) {
      this.log.error(error);
      return Promise.reject(error);
    }
  };
}
