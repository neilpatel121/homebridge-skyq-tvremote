import type {
  API,
  IndependentPlatformPlugin,
  Logging,
  PlatformConfig,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from 'homebridge';

import SkyRemote = require('sky-remote');
import SkyQCheck = require('sky-q');

const PLUGIN_NAME = 'homebridge-skyq-tvremote';
const PLATFORM_NAME = 'skyq-tvremote';

export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, SkyTVPlugin);
};

class SkyTVPlugin implements IndependentPlatformPlugin {
  private readonly log: Logging;
  private readonly config: PlatformConfig;
  private readonly api: API;
  private readonly Service;
  private readonly Characteristic;
  private readonly IpAddress: string;
  private readonly remoteControl: SkyRemote;
  private readonly boxCheck: SkyQCheck;

  private activeState:
    | API['hap']['Characteristic']['Active']['ACTIVE']
    | API['hap']['Characteristic']['Active']['INACTIVE'];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.publishExternalAccessory(this.config.name || 'TV');
    this.IpAddress = config.ipaddress as string;

    this.remoteControl = new SkyRemote(this.IpAddress);
    this.boxCheck = new SkyQCheck({ip:this.IpAddress});
    this.activeState = 0;

    this.boxCheck.getPowerState().then(isOn=>{
      if (isOn) {
        this.activeState = 1;
        this.log('sky box is on');
        
      } else {
        this.activeState = 0;
        this.log('the sky box is in standby');
        
      }
    },
    ).catch(err=>{
      this.log('Perhaps looking at this error will help you figure out why' + err);
    });

    log.info('Sky TV platform finished initializing!');
  }

  send = async (command: string) => {
    try {
      this.remoteControl.press(command);
    } catch (error) {
      this.log.error(error);
      return Promise.reject(error);
    }
  };

  publishExternalAccessory = (name: string) => {
    // generate a UUID
    const uuid = this.api.hap.uuid.generate(`homebridge:${PLUGIN_NAME}` + name);

    // create the accessory
    const tvAccessory = new this.api.platformAccessory(name, uuid);

    // set the accessory category
    tvAccessory.category = this.api.hap.Categories.TV_SET_TOP_BOX;

    // add the tv service
    const tvService = tvAccessory.addService(this.Service.Television);

    // set the tv name
    tvService.setCharacteristic(this.Characteristic.ConfiguredName, name);

    // set sleep discovery characteristic
    tvService.setCharacteristic(
      this.Characteristic.SleepDiscoveryMode,
      this.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
    );

    // handle on / off events using the Active characteristic
    tvService
      .getCharacteristic(this.Characteristic.Active)
      .on('get', (callback: CharacteristicGetCallback) => {
        this.log.info(
          'get Active: ' + (this.activeState ? 'ACTIVE' : 'INACTIVE'),
        );
        callback(undefined, this.activeState);
      })
      .on(
        'set',
        (
          newValue: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          if (!!newValue === !!this.activeState) {
            this.log.info(
              'skipping Active; new value is equal to current value',
            );
            return callback();
          }
          this.log.info('set Active => setNewValue: ' + newValue);
          this.send('power')
            .then(() => {
              this.activeState = newValue
                ? this.api.hap.Characteristic.Active.ACTIVE
                : this.api.hap.Characteristic.Active.INACTIVE;
              tvService.updateCharacteristic(
                this.Characteristic.Active,
                this.activeState,
              );
              callback();
            })
            .catch((error) => {
              this.log.error(error);
              callback(error);
            });
        },
      );

    // handle remote control input
    tvService
      .getCharacteristic(this.Characteristic.RemoteKey)
      .on(
        'set',
        (
          newValue: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          const command: string | undefined = (() => {
            switch (newValue) {
              case this.Characteristic.RemoteKey.ARROW_UP:
                return 'up';
              case this.Characteristic.RemoteKey.ARROW_DOWN:
                return 'down';
              case this.Characteristic.RemoteKey.ARROW_LEFT:
                return 'left';
              case this.Characteristic.RemoteKey.ARROW_RIGHT:
                return 'right';
              case this.Characteristic.RemoteKey.SELECT:
                return 'select';
              case this.Characteristic.RemoteKey.PLAY_PAUSE:
                return 'play';
              case this.Characteristic.RemoteKey.INFORMATION:
                return 'tvguide';
              case this.Characteristic.RemoteKey.BACK:
                return 'backup';
              case this.Characteristic.RemoteKey.EXIT:
            }
          })();
          if (!command) {
            this.log.error(
              `skipping Remote Key Pressed; unknown newValue: ${newValue}`,
            );
            callback();
          } else {
            this.log.info(`set Remote Key Pressed: ${command}`);
            this.send(command)
              .then(() => callback())
              .catch((error) => {
                this.log.error(error);
                callback(error);
              });
          }
        },
      );

    /**
     * Create a speaker service to allow volume control
     */

    const speakerService = tvAccessory.addService(
      this.Service.TelevisionSpeaker,
    );

    speakerService
      .setCharacteristic(
        this.Characteristic.Active,
        this.Characteristic.Active.ACTIVE,
      )
      .setCharacteristic(
        this.Characteristic.VolumeControlType,
        this.Characteristic.VolumeControlType.RELATIVE,
      );

    // handle volume control
    speakerService
      .getCharacteristic(this.Characteristic.VolumeSelector)
      .on(
        'set',
        (
          newValue: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          const command = (() => {
            switch (newValue) {
              case this.Characteristic.VolumeSelector.INCREMENT:
                return 'channelup';
              case this.Characteristic.VolumeSelector.DECREMENT:
                return 'channeldown';
            }
          })();
          if (!command) {
            this.log.error(
              `skipping VolumeSelector; unknown newValue: ${newValue}`,
            );
            callback();
          } else {
            this.log.info(`set VolumeSelector: ${command}`);
            this.send(command)
              .then(() => callback())
              .catch((error) => {
                this.log.error(error);
                callback(error);
              });
          }
        },
      );

    /**
     * Create TV Input Source Services
     * These are the inputs the user can select from.
     * When a user selected an input the corresponding Identifier Characteristic
     * is sent to the TV Service ActiveIdentifier Characteristic handler.
     */

    // Switch
    /**
  * removed switch code to address https://github.com/neilpatel121/homebridge-skyq-tvremote/issues/7
     */

    /**
     * Publish as external accessory
     * Only one TV can exist per bridge, to bypass this limitation, you should
     * publish your TV as an external accessory.
     */

    this.api.publishExternalAccessories(PLUGIN_NAME, [tvAccessory]);
  };
}
