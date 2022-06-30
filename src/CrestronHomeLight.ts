import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { CrestronDevice } from './crestronClient';

import { CrestronHomePlatform, CrestronAccessory } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class CrestronHomeLight implements CrestronAccessory{
  private service: Service;

  private lightStates = {
    On: false,
    Brightness: 100,
  };

  public crestronId = 0;

  constructor(
    private readonly platform: CrestronHomePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    this.crestronId = accessory.context.device.id;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Crestron Electronics')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    this.platform.log.debug('Adding Lightbulb', this.accessory.displayName, accessory.context.device);
    this.service = this.accessory.getService(this.platform.Service.Lightbulb)
      || this.accessory.addService(this.platform.Service.Lightbulb);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.lightStates.On = (accessory.context.device.level > 0);
    this.lightStates.Brightness = this.crestronRangeValueToPercentage(accessory.context.device.level);

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setLightsState.bind(this))                // SET - bind to the `setLightsState` method below
      .onGet(this.getLightsState.bind(this));               // GET - bind to the `getLightsState` method below

    if (accessory.context.device.subType === 'Dimmer') {
      // register handlers for the Brightness Characteristic
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below
    }
  }

  public updateState(device: CrestronDevice): void {
    const level = this.crestronRangeValueToPercentage(device.level);
    this.platform.log.debug('Updating Light state:', this.accessory.displayName, level);
    this.lightStates.On = (level > 0);
    this.lightStates.Brightness = level;

    this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(this.lightStates.On);
    if(this.accessory.context.device.subType === 'Dimmer') {
      this.service.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.lightStates.Brightness);
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setLightsState(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.lightStates.On = value as boolean;
    const level = value ? 65535 : 0;

    this.platform.crestronClient.setLightsState([{ id: this.crestronId, level: level, time: 0 }]);
    this.platform.log.debug('Set Light On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   */
  getLightsState(): CharacteristicValue {

    this.platform.log.debug('Get Light state for:', this.accessory.displayName, this.lightStates);
    return this.lightStates.On;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.lightStates.Brightness = value as number;

    this.platform.crestronClient.setLightsState(
      [{ id: this.crestronId, level: this.percentageToCrestronRangeValue(value as number), time: 0 }]);
    this.platform.log.debug('Set Brightness -> ', value);
  }

  crestronRangeValueToPercentage(value: number): number{
    if(value > 0){
      return Math.round((value / 65535) * 100);
    }
    return value;
  }

  percentageToCrestronRangeValue(value: number): number{
    if(value === 0){
      return 0;
    }
    return Math.round((65535 * value) / 100);
  }
}


