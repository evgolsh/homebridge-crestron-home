import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { CrestronDevice } from './crestronClient';

import { CrestronHomePlatform, CrestronAccessory } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each door lock accessory your platform registers
 */
export class CrestronHomeDoorLock implements CrestronAccessory {
  private service: Service;

  private lockStates = {
    LockCurrentState: 0, // UNKNOWN
    LockTargetState: 0,  // UNSECURED
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
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `Crestron-${this.crestronId}`);

    this.platform.log.debug('Adding Door Lock', this.accessory.displayName, accessory.context.device);
    this.service = this.accessory.getService(this.platform.Service.LockMechanism)
      || this.accessory.addService(this.platform.Service.LockMechanism);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // Initialize states from device context
    this.lockStates.LockCurrentState = this.crestronStatusToHomeKit(
      accessory.context.device.lockStatus || 'unknown',
    );
    this.lockStates.LockTargetState = this.lockStates.LockCurrentState ===
      this.platform.Characteristic.LockCurrentState.SECURED
      ? this.platform.Characteristic.LockTargetState.SECURED
      : this.platform.Characteristic.LockTargetState.UNSECURED;

    // register handlers for the Lock Current State Characteristic (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState)
      .onGet(this.getLockCurrentState.bind(this));

    // register handlers for the Lock Target State Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.LockTargetState)
      .onSet(this.setLockTargetState.bind(this))
      .onGet(this.getLockTargetState.bind(this));
  }

  public updateState(device: CrestronDevice): void {
    this.platform.log.debug('Updating Door Lock state:', this.accessory.displayName, device);

    // Update lock state if available
    if (device.lockStatus) {
      this.lockStates.LockCurrentState = this.crestronStatusToHomeKit(device.lockStatus);

      // Update target state to match current state (since we don't have separate target state from API)
      this.lockStates.LockTargetState = this.lockStates.LockCurrentState ===
        this.platform.Characteristic.LockCurrentState.SECURED
        ? this.platform.Characteristic.LockTargetState.SECURED
        : this.platform.Characteristic.LockTargetState.UNSECURED;
    }

    // Update HomeKit characteristics
    this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState)
      .updateValue(this.lockStates.LockCurrentState);
    this.service.getCharacteristic(this.platform.Characteristic.LockTargetState)
      .updateValue(this.lockStates.LockTargetState);
  }

  /**
   * Handle requests to get the current value of the "Lock Current State" characteristic
   */
  getLockCurrentState(): CharacteristicValue {
    this.platform.log.debug('Get Lock Current State for:', this.accessory.displayName, this.lockStates.LockCurrentState);
    return this.lockStates.LockCurrentState;
  }

  /**
   * Handle requests to get the current value of the "Lock Target State" characteristic
   */
  getLockTargetState(): CharacteristicValue {
    this.platform.log.debug('Get Lock Target State for:', this.accessory.displayName, this.lockStates.LockTargetState);
    return this.lockStates.LockTargetState;
  }

  /**
   * Handle "SET" requests from HomeKit to set the "Lock Target State" characteristic
   */
  async setLockTargetState(value: CharacteristicValue) {
    this.lockStates.LockTargetState = value as number;

    // Immediately update current state to show HomeKit we're responding
    this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState)
      .updateValue(this.lockStates.LockTargetState === this.platform.Characteristic.LockTargetState.SECURED
        ? this.platform.Characteristic.LockCurrentState.SECURED
        : this.platform.Characteristic.LockCurrentState.UNSECURED,
      );

    // Send command to Crestron
    if (this.lockStates.LockTargetState === this.platform.Characteristic.LockTargetState.SECURED) {
      // Lock the door
      await this.platform.crestronClient.lockDoor(this.crestronId);
      this.platform.log.debug('Locking door ->', this.accessory.displayName);
    } else {
      // Unlock the door
      await this.platform.crestronClient.unlockDoor(this.crestronId);
      this.platform.log.debug('Unlocking door ->', this.accessory.displayName);
    }
  }

  /**
   * Convert Crestron lock status string to HomeKit lock state number
   */
  private crestronStatusToHomeKit(status: string): number {
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'locked':
        return this.platform.Characteristic.LockCurrentState.SECURED;
      case 'unlocked':
        return this.platform.Characteristic.LockCurrentState.UNSECURED;
      case 'jammed':
        return this.platform.Characteristic.LockCurrentState.JAMMED;
      default:
        return this.platform.Characteristic.LockCurrentState.UNKNOWN;
    }
  }
}
