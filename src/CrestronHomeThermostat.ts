import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { CrestronDevice } from './crestronClient';

import { CrestronHomePlatform, CrestronAccessory } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each thermostat accessory your platform registers
 */
export class CrestronHomeThermostat implements CrestronAccessory {
  private service: Service;

  private thermostatStates = {
    CurrentTemperature: 20,
    TargetTemperature: 20,
    CurrentHeatingCoolingState: 0, // OFF
    TargetHeatingCoolingState: 0, // OFF
    TemperatureDisplayUnits: 0, // Celsius
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

    this.platform.log.debug('Adding Thermostat', this.accessory.displayName, accessory.context.device);
    this.service = this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // Initialize states from device context - convert from DeciFahrenheit to Celsius for HomeKit
    this.thermostatStates.CurrentTemperature = this.deciFahrenheitToCelsius(accessory.context.device.currentTemperature || 720);

    // Get target temperature from currentSetPoint array (Cool or Heat)
    const coolSetPoint = accessory.context.device.currentSetPoint?.find(sp => sp.type.toLowerCase() === 'cool');
    const heatSetPoint = accessory.context.device.currentSetPoint?.find(sp => sp.type.toLowerCase() === 'heat');
    this.thermostatStates.TargetTemperature = this.deciFahrenheitToCelsius(
      coolSetPoint?.temperature || heatSetPoint?.temperature || 720,
    );

    // Convert mode strings to HomeKit values
    this.thermostatStates.CurrentHeatingCoolingState = this.crestronModeToHomeKit(
      accessory.context.device.currentMode || 'Off', true,
    );
    this.thermostatStates.TargetHeatingCoolingState = this.crestronModeToHomeKit(
      accessory.context.device.currentMode || 'Off', false,
    );

    // Temperature units: 0 = Celsius, 1 = Fahrenheit (HomeKit needs Celsius internally)
    this.thermostatStates.TemperatureDisplayUnits = 1; // Display in Fahrenheit but send Celsius to HomeKit

    // register handlers for the Current Temperature Characteristic (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // register handlers for the Target Temperature Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this))
      .onGet(this.getTargetTemperature.bind(this));

    // register handlers for the Current Heating Cooling State Characteristic (read-only)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    // register handlers for the Target Heating Cooling State Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this))
      .onGet(this.getTargetHeatingCoolingState.bind(this));

    // register handlers for the Temperature Display Units Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onSet(this.setTemperatureDisplayUnits.bind(this))
      .onGet(this.getTemperatureDisplayUnits.bind(this));

    // Set supported modes - OFF, HEAT, COOL, AUTO
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
          this.platform.Characteristic.TargetHeatingCoolingState.COOL,
          this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
        ],
      });

    // Set temperature range (in Celsius for HomeKit, but will display as Fahrenheit)
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: 10,
        maxValue: 32,
        minStep: 0.5,
      });
  }

  public updateState(device: CrestronDevice): void {
    this.platform.log.debug('Updating Thermostat state:', this.accessory.displayName, device);

    // Update current temperature (convert from DeciFahrenheit to Celsius for HomeKit)
    if (device.currentTemperature !== undefined) {
      this.thermostatStates.CurrentTemperature = this.deciFahrenheitToCelsius(device.currentTemperature);
    }

    // Update target temperature from currentSetPoint
    if (device.currentSetPoint && device.currentSetPoint.length > 0) {
      const coolSetPoint = device.currentSetPoint.find(sp => sp.type.toLowerCase() === 'cool');
      const heatSetPoint = device.currentSetPoint.find(sp => sp.type.toLowerCase() === 'heat');
      const targetTemp = coolSetPoint?.temperature || heatSetPoint?.temperature;
      if (targetTemp) {
        this.thermostatStates.TargetTemperature = this.deciFahrenheitToCelsius(targetTemp);
      }
    }

    // Update heating/cooling states
    if (device.currentMode) {
      this.thermostatStates.CurrentHeatingCoolingState = this.crestronModeToHomeKit(device.currentMode, true);
      this.thermostatStates.TargetHeatingCoolingState = this.crestronModeToHomeKit(device.currentMode, false);
    }

    // Update all HomeKit characteristics
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .updateValue(this.thermostatStates.CurrentTemperature);
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .updateValue(this.thermostatStates.TargetTemperature);
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .updateValue(this.thermostatStates.CurrentHeatingCoolingState);
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .updateValue(this.thermostatStates.TargetHeatingCoolingState);
    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .updateValue(this.thermostatStates.TemperatureDisplayUnits);
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  getCurrentTemperature(): CharacteristicValue {
    this.platform.log.debug('Get Current Temperature for:', this.accessory.displayName, this.thermostatStates.CurrentTemperature);
    return this.thermostatStates.CurrentTemperature;
  }

  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
  getTargetTemperature(): CharacteristicValue {
    this.platform.log.debug('Get Target Temperature for:', this.accessory.displayName, this.thermostatStates.TargetTemperature);
    return this.thermostatStates.TargetTemperature;
  }

  /**
   * Handle "SET" requests from HomeKit to set the "Target Temperature" characteristic
   */
  async setTargetTemperature(value: CharacteristicValue) {
    this.thermostatStates.TargetTemperature = value as number;

    // Convert Celsius (from HomeKit) to DeciFahrenheit for Crestron API
    const tempInDeciFahrenheit = this.celsiusToDeciFahrenheit(this.thermostatStates.TargetTemperature);

    // Determine setpoint type based on current mode
    const currentMode = this.thermostatStates.TargetHeatingCoolingState;
    let setPointType = 'Cool';
    if (currentMode === this.platform.Characteristic.TargetHeatingCoolingState.HEAT) {
      setPointType = 'Heat';
    } else if (currentMode === this.platform.Characteristic.TargetHeatingCoolingState.AUTO) {
      setPointType = 'Auto';
    }

    await this.platform.crestronClient.setThermostatSetPoint({
      id: this.crestronId,
      setpoints: [{
        type: setPointType as 'Cool' | 'Heat' | 'Auto',
        temperature: tempInDeciFahrenheit,
      }],
    });

    this.platform.log.debug('Set Target Temperature ->', value, '(', tempInDeciFahrenheit, 'DeciFahrenheit)');
  }

  /**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
  getCurrentHeatingCoolingState(): CharacteristicValue {
    this.platform.log.debug(
      'Get Current Heating Cooling State for:',
      this.accessory.displayName,
      this.thermostatStates.CurrentHeatingCoolingState,
    );
    return this.thermostatStates.CurrentHeatingCoolingState;
  }

  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
  getTargetHeatingCoolingState(): CharacteristicValue {
    this.platform.log.debug(
      'Get Target Heating Cooling State for:',
      this.accessory.displayName,
      this.thermostatStates.TargetHeatingCoolingState,
    );
    return this.thermostatStates.TargetHeatingCoolingState;
  }

  /**
   * Handle "SET" requests from HomeKit to set the "Target Heating Cooling State" characteristic
   */
  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    this.thermostatStates.TargetHeatingCoolingState = value as number;

    // Convert HomeKit mode to Crestron mode
    const crestronMode = this.homeKitModeToCrestron(this.thermostatStates.TargetHeatingCoolingState);

    await this.platform.crestronClient.setThermostatMode({
      id: this.crestronId,
      mode: crestronMode,
    });

    this.platform.log.debug('Set Target Heating Cooling State ->', value, '(', crestronMode, ')');
  }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
  getTemperatureDisplayUnits(): CharacteristicValue {
    this.platform.log.debug(
      'Get Temperature Display Units for:',
      this.accessory.displayName,
      this.thermostatStates.TemperatureDisplayUnits,
    );
    return this.thermostatStates.TemperatureDisplayUnits;
  }

  /**
   * Handle "SET" requests from HomeKit to set the "Temperature Display Units" characteristic
   */
  async setTemperatureDisplayUnits(value: CharacteristicValue) {
    this.thermostatStates.TemperatureDisplayUnits = value as number;
    // Note: Crestron doesn't appear to have an API for changing display units
    // This is mainly for HomeKit compatibility
    this.platform.log.debug('Set Temperature Display Units ->', value, '(display only)');
  }

  /**
   * Convert DeciFahrenheit (Crestron format) to Fahrenheit (HomeKit format)
   */
  private deciFahrenheitToFahrenheit(deciFahrenheit: number): number {
    const fahrenheit = deciFahrenheit / 10;
    return Math.round(fahrenheit * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Convert Fahrenheit (HomeKit format) to DeciFahrenheit (Crestron format)
   */
  private fahrenheitToDeciFahrenheit(fahrenheit: number): number {
    return Math.round(fahrenheit * 10); // Convert to DeciFahrenheit
  }

  /**
   * Convert DeciFahrenheit (Crestron format) to Celsius (HomeKit format)
   * Keeping for compatibility if needed
   */
  private deciFahrenheitToCelsius(deciFahrenheit: number): number {
    const fahrenheit = deciFahrenheit / 10;
    const celsius = (fahrenheit - 32) * 5 / 9;
    return Math.round(celsius * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Convert Celsius (HomeKit format) to DeciFahrenheit (Crestron format)
   * Keeping for compatibility if needed
   */
  private celsiusToDeciFahrenheit(celsius: number): number {
    const fahrenheit = (celsius * 9 / 5) + 32;
    return Math.round(fahrenheit * 10); // Convert to DeciFahrenheit
  }

  /**
   * Convert Crestron mode string to HomeKit mode number
   */
  private crestronModeToHomeKit(mode: string, isCurrentState: boolean): number {
    const upperMode = mode.toUpperCase();
    switch (upperMode) {
      case 'OFF':
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      case 'HEAT':
        return isCurrentState
          ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
          : this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
      case 'COOL':
        return isCurrentState
          ? this.platform.Characteristic.CurrentHeatingCoolingState.COOL
          : this.platform.Characteristic.TargetHeatingCoolingState.COOL;
      case 'AUTO':
        return isCurrentState
          ? this.platform.Characteristic.CurrentHeatingCoolingState.OFF // Auto doesn't exist for current state
          : this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
      default:
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }

  /**
   * Convert HomeKit mode number to Crestron mode string
   */
  private homeKitModeToCrestron(homekitMode: number): 'HEAT' | 'COOL' | 'AUTO' | 'OFF' {
    switch (homekitMode) {
      case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
        return 'HEAT';
      case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
        return 'COOL';
      case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
        return 'AUTO';
      case this.platform.Characteristic.TargetHeatingCoolingState.OFF:
      default:
        return 'OFF';
    }
  }
}
