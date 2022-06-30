import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

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
    TargetPosition: 0,
    PositionState: this.platform.Characteristic.PositionState.STOPPED,
  };

  private crestronId = 0;
  private sceneStatus = false;

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


    switch (accessory.context.device.type) {

      case 'Dimmer':  // Dimmer needs brightness, while Switch has On/Off only
      case 'Switch':
        this.createLightBulbService(accessory);
        // each service must implement at-minimum the "required characteristics" for the given service type
        // see https://developers.homebridge.io/#/service/Lightbulb
        this.lightStates.On = (accessory.context.device.level > 0);
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
        break;
      case 'shade':
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
      case 'Scene':

        switch(accessory.context.device.subType) {
          case 'Lighting':  // Expose a Lighting schene as a LightBulb
            this.createLightBulbService(accessory);
            this.sceneStatus = this.accessory.context.device.status;

            this.service.getCharacteristic(this.platform.Characteristic.On)
              .onGet(this.getSceneState.bind(this))
              .onSet(this.recallScene.bind(this));
            break;
          case 'Shade':
            this.service = this.accessory.getService(this.platform.Service.Switch)
            || this.accessory.addService(this.platform.Service.Switch);

            this.service.getCharacteristic(this.platform.Characteristic.On)
              .onGet(this.getSceneState.bind(this))
              .onSet(this.recallScene.bind(this));
            break;
          default:
            break;
        }
        break;
      default:
        this.platform.log.debug('Unsupported accessory type:', accessory.context.device.type);
        break;
    }
  }

  getProgrammableSwitchEvent(){
    this.platform.log.debug('Triggered GET ProgrammableSwitchEvent');

    // set this to a valid value for ProgrammableSwitchEvent
    const currentValue = this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;

    return currentValue;
  }

  private createLightBulbService(accessory: PlatformAccessory){
    this.platform.log.debug('Adding Lightbulb', this.accessory.displayName, accessory.context.device);
    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb)
      || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
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
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getLightsState(): Promise<CharacteristicValue> {

    const deviceState = await this.platform.crestronClient.getDevice(this.crestronId);

    this.platform.log.debug('Get Light state for:', this.accessory.displayName); //, deviceState);
    const isOn = (deviceState.level > 0);

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
    this.lightStates.Brightness = this.percentageToCrestronRangeValue(value as number);

    this.platform.crestronClient.setLightsState(
      [{ id: this.crestronId, level: this.lightStates.Brightness, time: 0 }]);
    this.platform.log.debug('Set Brightness -> ', value);
  }

  async getShadeCurrentPosition(): Promise<CharacteristicValue>{

    this.platform.log.debug('Get Shade current position called for', this.accessory.displayName);
    const currentState = await this.platform.crestronClient.getShadeState(this.crestronId);

    const position = this.crestronRangeValueToPercentage(currentState.position);
    this.shadeStates.CurrentPosition = position;
    this.shadeStates.TargetPosition = position;

    this.platform.log.debug('Shade current position for', this.accessory.displayName, currentState, position);
    return position;
  }

  async getShadePositionState(): Promise<CharacteristicValue>{

    this.platform.log.debug('Get Shade position state called for', this.accessory.displayName);

    return this.shadeStates.PositionState;
  }

  async setShadeTargetPosition(value: CharacteristicValue){

    this.platform.log.debug('Set Shade target position called for: ', this.accessory.displayName, value);
    this.shadeStates.TargetPosition = this.percentageToCrestronRangeValue(value as number);

    this.platform.crestronClient.setShadesState(
      [{id: this.crestronId, position: this.shadeStates.TargetPosition}]);
  }

  async getSceneState(): Promise<CharacteristicValue>{
    const scene = await this.platform.crestronClient.getScene(this.crestronId);
    this.platform.log.debug('Get scene state:', scene);

    this.sceneStatus = scene.status;
    return this.sceneStatus;
  }

  async recallScene(value: CharacteristicValue) {

    this.platform.log.debug('Recalling scene with status:', value);
    this.platform.crestronClient.recallScene(this.crestronId);
  }

  async getShadeTargetPosition(): Promise<CharacteristicValue>{

    this.platform.log.debug('Get Shade targert position called for', this.accessory.displayName);
    return this.shadeStates.TargetPosition;
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


