import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { CrestronDevice } from './crestronClient';

import { CrestronHomePlatform, CrestronAccessory } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each security system accessory your platform registers
 */
export class CrestronHomeSecuritySystem implements CrestronAccessory {
  private service: Service;

  private securitySystemStates = {
    SecuritySystemCurrentState: 3, // Disarmed by default
    SecuritySystemTargetState: 3,  // Disarmed by default
    SecuritySystemAlarmType: 0,    // No alarm
    StatusFault: 0,                // No fault
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
      .setCharacteristic(this.platform.Characteristic.Model, 'Security System')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `Crestron-Security-${this.crestronId}`);

    this.platform.log.debug('Adding Security System', this.accessory.displayName, accessory.context.device);
    this.service = this.accessory.getService(this.platform.Service.SecuritySystem)
      || this.accessory.addService(this.platform.Service.SecuritySystem);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // Initialize states from device context
    if (accessory.context.device.securityCurrentState) {
      this.securitySystemStates.SecuritySystemCurrentState = this.crestronStateToHomeKit(
        accessory.context.device.securityCurrentState,
      );
      this.securitySystemStates.SecuritySystemTargetState = this.securitySystemStates.SecuritySystemCurrentState;
    }

    // Set connection status
    if (accessory.context.device.connectionStatus) {
      this.securitySystemStates.StatusFault =
        accessory.context.device.connectionStatus === 'online' ? 0 : 1;
    }

    // register handlers for the Security System Current State Characteristic (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .onGet(this.getSecuritySystemCurrentState.bind(this));

    // register handlers for the Security System Target State Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .onSet(this.setSecuritySystemTargetState.bind(this))
      .onGet(this.getSecuritySystemTargetState.bind(this));

    // register handlers for the Security System Alarm Type Characteristic (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemAlarmType)
      .onGet(this.getSecuritySystemAlarmType.bind(this));

    // register handlers for the Status Fault Characteristic (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.StatusFault)
      .onGet(this.getStatusFault.bind(this));
  }

  public updateState(device: CrestronDevice): void {
    this.platform.log.debug('Updating Security System state:', this.accessory.displayName, device);

    // Update current state
    if (device.securityCurrentState !== undefined) {
      this.securitySystemStates.SecuritySystemCurrentState = this.crestronStateToHomeKit(device.securityCurrentState);
      // Update target state to match current state (since we can't set target yet)
      this.securitySystemStates.SecuritySystemTargetState = this.securitySystemStates.SecuritySystemCurrentState;
    }

    // Update alarm type based on current state
    if (device.securityCurrentState === 'Alarm' || device.securityCurrentState === 'Fire') {
      this.securitySystemStates.SecuritySystemAlarmType = 1; // Unknown alarm type
    } else {
      this.securitySystemStates.SecuritySystemAlarmType = 0; // No alarm
    }

    // Update connection status
    if (device.connectionStatus !== undefined) {
      this.securitySystemStates.StatusFault = device.connectionStatus === 'online' ? 0 : 1;
    }

    // Update all HomeKit characteristics
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .updateValue(this.securitySystemStates.SecuritySystemCurrentState);
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .updateValue(this.securitySystemStates.SecuritySystemTargetState);
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemAlarmType)
      .updateValue(this.securitySystemStates.SecuritySystemAlarmType);
    this.service.getCharacteristic(this.platform.Characteristic.StatusFault)
      .updateValue(this.securitySystemStates.StatusFault);
  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  getSecuritySystemCurrentState(): CharacteristicValue {
    this.platform.log.debug(
      'Get Security System Current State for:',
      this.accessory.displayName,
      this.securitySystemStates.SecuritySystemCurrentState,
    );
    return this.securitySystemStates.SecuritySystemCurrentState;
  }

  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  getSecuritySystemTargetState(): CharacteristicValue {
    this.platform.log.debug(
      'Get Security System Target State for:',
      this.accessory.displayName,
      this.securitySystemStates.SecuritySystemTargetState,
    );
    return this.securitySystemStates.SecuritySystemTargetState;
  }

  /**
   * Handle requests to get the current value of the "Security System Alarm Type" characteristic
   */
  getSecuritySystemAlarmType(): CharacteristicValue {
    this.platform.log.debug(
      'Get Security System Alarm Type for:',
      this.accessory.displayName,
      this.securitySystemStates.SecuritySystemAlarmType,
    );
    return this.securitySystemStates.SecuritySystemAlarmType;
  }

  /**
   * Handle requests to get the current value of the "Status Fault" characteristic
   */
  getStatusFault(): CharacteristicValue {
    this.platform.log.debug(
      'Get Status Fault for:',
      this.accessory.displayName,
      this.securitySystemStates.StatusFault,
    );
    return this.securitySystemStates.StatusFault;
  }

  /**
   * Convert Crestron security state to HomeKit security state
   *
   * HomeKit SecuritySystemCurrentState values:
   * 0 = Stay Arm
   * 1 = Away Arm
   * 2 = Night Arm
   * 3 = Disarmed
   * 4 = Alarm Triggered
   *
   * Crestron states from API: "Alarm", "ArmAway", "ArmInstant", "ArmStay", "Disarmed", "EntryDelay", "ExitDelay", "Fire"
   */
  private crestronStateToHomeKit(crestronState: string): number {
    const upperState = crestronState.toUpperCase();

    switch (upperState) {
      case 'DISARMED':
        return this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;

      case 'ARMSTAY':
        return this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM;

      case 'ARMAWAY':
        return this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;

      case 'ARMINSTANT':
        // Map "Instant" to "Night Arm" as closest equivalent
        return this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;

      case 'ALARM':
      case 'FIRE':
        return this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;

      case 'ENTRYDELAY':
      case 'EXITDELAY':
        // During entry/exit delay, system is still technically armed
        // Default to Away Arm for delays (could be refined based on previous state)
        return this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;

      default:
        this.platform.log.warn('Unknown Crestron security state:', crestronState, '- defaulting to Disarmed');
        return this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
    }
  }

  /**
   * Convert HomeKit security state to Crestron security state
   * Used by the SET handler to translate HomeKit commands to Crestron API calls
   */
  private homeKitStateToCrestron(homeKitState: number): 'Disarmed' | 'ArmStay' | 'ArmAway' | 'ArmInstant' {
    switch (homeKitState) {
      case this.platform.Characteristic.SecuritySystemTargetState.DISARM:
        return 'Disarmed';
      case this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM:
        return 'ArmStay';
      case this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM:
        return 'ArmAway';
      case this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        return 'ArmInstant';
      default:
        return 'Disarmed';
    }
  }

  /**
   * Handle "SET" requests from HomeKit to set the "Security System Target State" characteristic
   * This allows HomeKit to arm/disarm the security system
   */
  async setSecuritySystemTargetState(value: CharacteristicValue) {
    this.securitySystemStates.SecuritySystemTargetState = value as number;
    const crestronState = this.homeKitStateToCrestron(this.securitySystemStates.SecuritySystemTargetState);

    this.platform.log.info(
      `🔒 SECURITY: Setting security system "${this.accessory.displayName}" to: ${crestronState} (HomeKit value: ${value})`,
    );

    try {
      await this.platform.crestronClient.setSecuritySystemState({
        id: this.crestronId,
        state: crestronState,
      });

      this.platform.log.info(`✅ SECURITY: Successfully set security system state to: ${crestronState}`);
    } catch (error) {
      this.platform.log.error('❌ SECURITY: Failed to set security system state:', error);
      // Reset target state to current state on error
      this.securitySystemStates.SecuritySystemTargetState = this.securitySystemStates.SecuritySystemCurrentState;
      throw error;
    }
  }
}
