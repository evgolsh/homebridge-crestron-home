import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { CrestronHomePlatform } from './platform';

export class CrestronHomeShade {
  private service: Service;

  private shadeStates = {
    CurrentPosition: 0,
    TargetPosition: 0,
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


    this.service = this.accessory.getService(this.platform.Service.WindowCovering)
          || this.accessory.addService(this.platform.Service.WindowCovering);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getShadeCurrentPosition.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(this.getShadeTargetPosition.bind(this))
      .onSet(this.setShadeTargetPosition.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getShadePositionState.bind(this));
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


