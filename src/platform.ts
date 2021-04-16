import {
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  IndependentPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import { PLUGIN_NAME } from './settings';

import SkyRemote = require('sky-remote');
import SkyQCheck = require('sky-q');

let hap: HAP;
let Accessory: typeof PlatformAccessory;

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

    let activeState: ActiveCharacterstic = 0;

    boxCheck.getPowerState().then(isOn => {
      if (isOn) {
        activeState = 1;
        this.log('Sky box is on');
      } else {
        activeState = 0;
        this.log('The sky box is in standby');
      }
    }).catch(error => {
      this.log.error('Perhaps looking at this error will help you figure out why');
      this.log.error(error);
    });

    // Generate a UUID
    const uuid = hap.uuid.generate(`homebridge:${PLUGIN_NAME}:` + config.ipAddress);

    // Create the accessory
    const accessory = new Accessory(config.name, uuid);

    // Set the accessory category
    accessory.category = hap.Categories.TV_SET_TOP_BOX;

    // Add the accessory information service
    const accessoryInfoService = accessory.addService(hap.Service.AccessoryInformation);
    accessoryInfoService.setCharacteristic(hap.Characteristic.Manufacturer, 'Sky');

    // Add the TV service
    const tvService = accessory.addService(hap.Service.Television);

    // Set the TV name
    tvService.setCharacteristic(hap.Characteristic.ConfiguredName, config.name);

    // Set sleep discovery characteristic
    tvService.setCharacteristic(hap.Characteristic.SleepDiscoveryMode, hap.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

    // Handle on / off events using the active characteristic
    tvService.getCharacteristic(hap.Characteristic.Active)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        this.log.info('Get Active: ' + (activeState ? 'ACTIVE': 'INACTIVE'));
        callback(undefined, activeState);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (!!value === !!activeState) {
          this.log.info('Skipping Active: new value is equal to current value');
          return callback();
        }

        this.log.info('Set Active: ' + (value ? 'ACTIVE': 'INACTIVE'));

        this.send(remoteControl, 'power').then(() => {
          activeState = value ? 1 : 0;
          tvService.updateCharacteristic(hap.Characteristic.Active, activeState);
          callback();
        }).catch((error) => {
          this.log.error(error);
          callback(error);
        });
      },
      );

    // Handle remote control input
    tvService.getCharacteristic(hap.Characteristic.RemoteKey)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const command: string | undefined = (() => {
          switch (value) {
            case hap.Characteristic.RemoteKey.REWIND:
              return 'rewind';
            case hap.Characteristic.RemoteKey.FAST_FORWARD:
              return 'fastforward';
            case hap.Characteristic.RemoteKey.ARROW_UP:
              return 'up';
            case hap.Characteristic.RemoteKey.ARROW_DOWN:
              return 'down';
            case hap.Characteristic.RemoteKey.ARROW_LEFT:
              return 'left';
            case hap.Characteristic.RemoteKey.ARROW_RIGHT:
              return 'right';
            case hap.Characteristic.RemoteKey.SELECT:
              return 'select';
            case hap.Characteristic.RemoteKey.BACK:
              return 'backup';
            case hap.Characteristic.RemoteKey.PLAY_PAUSE:
              return 'play';
            case hap.Characteristic.RemoteKey.INFORMATION:
              return 'tvguide';
            case hap.Characteristic.RemoteKey.EXIT:
          }
        })();

        if (!command) {
          this.log.error(`Skipping Remote Key: unknown new value: ${value}`);
          return callback();
        }
        
        this.log.info('Set Remote Key: ' + command);
        this.send(remoteControl, command).then(() => callback()).catch((error) => {
          this.log.error(error);
          callback(error);
        });
      },
      );

    // Add the speaker service
    const speakerService = accessory.addService(hap.Service.TelevisionSpeaker);
    speakerService.setCharacteristic(hap.Characteristic.Active, hap.Characteristic.Active.ACTIVE);
    speakerService.setCharacteristic(hap.Characteristic.VolumeControlType, hap.Characteristic.VolumeControlType.RELATIVE);

    // Handle volume control
    speakerService.getCharacteristic(hap.Characteristic.VolumeSelector)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        const command = (() => {
          switch (value) {
            case hap.Characteristic.VolumeSelector.INCREMENT:
              return 'channelup';
            case hap.Characteristic.VolumeSelector.DECREMENT:
              return 'channeldown';
          }
        })();

        if (!command) {
          this.log.error(`Skipping Volume Selector: unknown newValue: ${value}`);
          return callback();
        }
        
        this.log.info('Set Volume Selector: ' + command);
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
