import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { type } from 'os';

import { CrestronHomePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class CrestronHomePlatformAccessory {
  private service!: Service;

  private lightStates = {
    On: false,
    Brightness: 100,
  };

  private shadeStates = {
    CurrentPosition: 0,
    TargetPosition: 100,
    PositionState: this.platform.Characteristic.PositionState.STOPPED,
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


    switch (accessory.context.device.subType) {
      case 'Dimmer':
      case 'Switch':
        platform.log.debug('Adding Lightbulb', accessory.displayName, accessory.context.device);
        // get the LightBulb service if it exists, otherwise create a new LightBulb service
        // you can create multiple services for each accessory
        this.service = this.accessory.getService(this.platform.Service.Lightbulb)
          || this.accessory.addService(this.platform.Service.Lightbulb);

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

        // each service must implement at-minimum the "required characteristics" for the given service type
        // see https://developers.homebridge.io/#/service/Lightbulb
        accessory.context.device.level > 0 ? this.lightStates.On = true : false;
        this.lightStates.Brightness = accessory.context.device.level;

        // register handlers for the On/Off Characteristic
        this.service.getCharacteristic(this.platform.Characteristic.On)
          .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
          .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

        if (accessory.context.device.subType === 'Dimmer') {
          // register handlers for the Brightness Characteristic
          this.service.getCharacteristic(this.platform.Characteristic.Brightness)
            .onSet(this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below
        }
        break;
      case 'Shade':
        this.service = this.accessory.getService(this.platform.Service.WindowCovering)
          || this.accessory.addService(this.platform.Service.WindowCovering);

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

        this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
          .onGet(this.getShadeCurrentPosition.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
          .onGet(this.getShadeTargetPosition.bind(this))
          .onSet(this.setShadeTargetPosition.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.PositionState)
          .onGet(this.getShadePositionState.bind(this));

        break;
      default:
        this.platform.log.debug('Unsupported device type:', accessory.context.device.subType);
        break;
    }

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    // const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    // /**
    //  * Updating characteristics values asynchronously.
    //  *
    //  * Example showing how to update the state of a Characteristic asynchronously instead
    //  * of using the `on('get')` handlers.
    //  * Here we change update the motion sensor trigger states on and off every 10 seconds
    //  * the `updateCharacteristic` method.
    //  *
    //  */
    // let motionDetected = false;
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected;

    //   // push the new value to HomeKit
    //   motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
    //   motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

    //   this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
    //   this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    // }, 10000);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.lightStates.On = value as boolean;
    const level = value ? 65535 : 0;

    this.platform.crestronClient.setLightsState([{ id: this.crestronId, level: level, time: 0 }]);
    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {

    const deviceState = await this.platform.crestronClient.getDevice(this.crestronId);

    this.platform.log.debug('Get Light state for:', this.accessory.displayName); //, deviceState);
    const isOn = deviceState.level > 0 ? true : false;

    this.lightStates.On = isOn;
    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return isOn;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.lightStates.Brightness = value as number;

    this.platform.log.debug('Set Brightness -> ', value);
  }

  async getShadeCurrentPosition(): Promise<CharacteristicValue>{

    this.platform.log.debug('Get Shade current position called for', this.accessory.displayName);
    const currentState = await this.platform.crestronClient.getShadeState(this.crestronId);

    const position = this.crestronPositionToPercentage(currentState.position);
    this.shadeStates.CurrentPosition = position;

    this.platform.log.debug('Shade current position for', this.accessory.displayName, currentState, position);
    return position;
  }

  async getShadePositionState(): Promise<CharacteristicValue>{

    this.platform.log.debug('Get Shade position state called for', this.accessory.displayName);

    return 1; // this.shadeStates.PositionState;
  }

  async setShadeTargetPosition(value: CharacteristicValue){

    const nValue = Number(value);
    this.platform.log.debug('Set Shade target position called for: ', this.accessory.displayName, value);
    this.shadeStates.TargetPosition = nValue;

    this.platform.crestronClient.setShadesState([{id: this.crestronId, position: this.percentageToCrestronRangeValue(nValue)}]);
  }

  async getShadeTargetPosition(): Promise<CharacteristicValue>{

    this.platform.log.debug('Get Shade targert position called for', this.accessory.displayName);
    return this.shadeStates.TargetPosition;
  }

  crestronPositionToPercentage(value: number): number{
    if(value > 0){
      return Math.round((value / 65535) * 100);
    }
    return value;
  }

  percentageToCrestronRangeValue(value: number): number{

    if(value === 0){
      return 0;
    }
    return (65535 * value) / 100;
  }
}


