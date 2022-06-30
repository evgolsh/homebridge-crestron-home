import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { CrestronDevice } from './crestronClient';

import { CrestronHomePlatform, CrestronAccessory } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class CrestronHomeScene implements CrestronAccessory {
  public crestronId = 0;

  private service!: Service;
  private sceneStatus = false;

  constructor(
    private readonly platform: CrestronHomePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // platform.log.debug('CREATING SCENE:', accessory.context.device);
    this.crestronId = accessory.context.device.id;
    this.sceneStatus = accessory.context.device.status;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Crestron Electronics')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');



    switch(accessory.context.device.subType) {
      case 'Lighting':  // Expose a Lighting schene as a LightBulb
        this.platform.log.debug('Adding Lighting scene Lightbulb:', this.accessory.displayName, accessory.context.device);

        this.service = this.accessory.getService(this.platform.Service.Lightbulb)
      || this.accessory.addService(this.platform.Service.Lightbulb);

        this.sceneStatus = this.accessory.context.device.status;
        break;
      case 'genericIO':
        this.service = this.accessory.getService(this.platform.Service.LockMechanism)
        || this.accessory.addService(this.platform.Service.LockMechanism);

        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState)
          .onGet(this.getLockCurrentState.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.LockTargetState)
          .onGet(this.getLockCurrentState.bind(this))
          .onSet(this.recallScene.bind(this));

        return;  // Finished with Lock setup, returning
      default:
        // by default scenes are exposed as Switch
        this.service = this.accessory.getService(this.platform.Service.Switch)
        || this.accessory.addService(this.platform.Service.Switch);
        break;
    }

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getSceneState.bind(this))
      .onSet(this.recallScene.bind(this));
  }

  public updateState(device: CrestronDevice): void {
    this.platform.log.debug('Updating Scene status:', this.accessory.displayName, device.status);
    this.sceneStatus = device.status;
  }

  getSceneState(): CharacteristicValue{
    this.platform.log.debug('Get scene state:', this.sceneStatus);

    return this.sceneStatus;
  }

  async recallScene(value: CharacteristicValue) {

    this.sceneStatus ? this.sceneStatus = false : this.sceneStatus = true;
    this.platform.log.debug('Recalling scene with status:', value);
    this.platform.crestronClient.recallScene(this.crestronId);
  }

  getLockCurrentState(): CharacteristicValue{
    return this.platform.Characteristic.LockCurrentState.SECURED;
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


