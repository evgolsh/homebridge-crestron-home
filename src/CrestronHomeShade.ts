import { Service, PlatformAccessory, CharacteristicValue, Nullable } from 'homebridge';
import { CrestronDevice } from './crestronClient';

import { CrestronHomePlatform, CrestronAccessory } from './platform';

export class CrestronHomeShade implements CrestronAccessory {
  public crestronId = 0;

  private service: Service;

  private shadeStates = {
    CurrentPosition: 0,
    TargetPosition: 0,
    PositionState: this.platform.Characteristic.PositionState.STOPPED,
  };

  private activeInterval: NodeJS.Timer | undefined;

  constructor(
    private readonly platform: CrestronHomePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    platform.log.debug('Creating Shade:', accessory.context.device);
    this.crestronId = accessory.context.device.id;
    this.shadeStates.CurrentPosition = this.crestronRangeValueToPercentage(accessory.context.device.position);
    this.shadeStates.TargetPosition = this.crestronRangeValueToPercentage(accessory.context.device.position);
    // this.initShadePositions();

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

  public updateState(device: CrestronDevice): void {
    const position = this.crestronRangeValueToPercentage(device.position);
    this.platform.log.debug('Updating shade position:', this.accessory.displayName, position);
    this.shadeStates.CurrentPosition = position;
  }

  getShadeCurrentPosition(): CharacteristicValue{

    this.platform.log.debug('Shade current position for', this.accessory.displayName, this.shadeStates.CurrentPosition);
    return this.shadeStates.CurrentPosition;
  }

  getShadePositionState(): CharacteristicValue{

    this.platform.log.debug('Get Shade position state called for', this.accessory.displayName);
    return this.shadeStates.PositionState;
  }

  async setShadeTargetPosition(value: CharacteristicValue){

    this.platform.log.debug('Set Shade target position called for: ', this.accessory.displayName, value);
    this.shadeStates.TargetPosition = value as number;

    this.platform.crestronClient.setShadesState(
      [{id: this.crestronId, position: this.percentageToCrestronRangeValue(value as number)}]);

    this.activeInterval = setInterval(this.updateShadePositions.bind(this), 10 * 1000);
  }

  getShadeTargetPosition(): CharacteristicValue{

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

  async updateShadePositions(){
    this.platform.log.debug('Updating shade position status');
    const currentState = await this.platform.crestronClient.getShadeState(this.crestronId);
    this.shadeStates.CurrentPosition = this.crestronRangeValueToPercentage(currentState.position);

    // this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.shadeStates.CurrentPosition);
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition).updateValue(this.shadeStates.CurrentPosition);
    this.platform.log.debug('Updating shade position status to:', this.shadeStates.CurrentPosition);

    if(this.shadeStates.TargetPosition === this.shadeStates.CurrentPosition){
      this.platform.log.debug('Target position achieved, Stopping interval', this.activeInterval);
      clearInterval(this.activeInterval);
    }
  }
}


