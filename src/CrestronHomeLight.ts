import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { CrestronHomePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class CrestronHomeLight {
  private service: Service;

  private lightStates = {
    On: false,
    Brightness: 100,
  };

  private crestronId = 0;

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
    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb)
      || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);


    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb
    accessory.context.device.level > 0 ? this.lightStates.On = true : false;
    this.lightStates.Brightness = accessory.context.device.level;

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
  async getLightsState(): Promise<CharacteristicValue> {

    const deviceState = await this.platform.crestronClient.getDevice(this.crestronId);

    this.platform.log.debug('Get Light state for:', this.accessory.displayName); //, deviceState);
    const isOn = deviceState.level > 0 ? true : false;

    this.lightStates.On = isOn;
    this.lightStates.Brightness = this.crestronRangeValueToPercentage(deviceState.level);
    return isOn;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.lightStates.Brightness = this.percentageToCrestronRangeValue(value as number);

    this.platform.crestronClient.setLightsState(
      [{ id: this.crestronId, level: this.lightStates.Brightness, time: 0 }]);
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


