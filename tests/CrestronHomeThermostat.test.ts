import { CrestronHomeThermostat } from '../src/CrestronHomeThermostat';
import { CrestronDevice } from '../src/crestronClient';

describe('CrestronHomeThermostat', () => {
  let thermostat: CrestronHomeThermostat;
  let mockPlatform: any;
  let mockAccessory: any;

  beforeEach(() => {
    mockPlatform = {
      Service: {
        AccessoryInformation: function() { return this; },
        Thermostat: function() { return this; },
      },
      Characteristic: {
        Manufacturer: { UUID: 'manufacturer' },
        Model: { UUID: 'model' },
        SerialNumber: { UUID: 'serial' },
        Name: { UUID: 'name' },
        CurrentTemperature: { UUID: 'currentTemperature' },
        TargetTemperature: { UUID: 'targetTemperature' },
        CurrentHeatingCoolingState: {
          OFF: 0,
          HEAT: 1,
          COOL: 2,
        },
        TargetHeatingCoolingState: {
          OFF: 0,
          HEAT: 1,
          COOL: 2,
          AUTO: 3,
        },
        TemperatureDisplayUnits: { UUID: 'temperatureDisplayUnits' },
      },
      crestronClient: {
        setThermostatSetPoint: jest.fn(),
        setThermostatMode: jest.fn(),
      },
      log: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const mockCharacteristic = {
      onSet: jest.fn().mockReturnThis(),
      onGet: jest.fn().mockReturnThis(),
      updateValue: jest.fn().mockReturnThis(),
      setProps: jest.fn().mockReturnThis(),
    };

    const mockService = {
      setCharacteristic: jest.fn().mockReturnThis(),
      getCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
    };

    mockAccessory = {
      context: {
        device: {
          id: 101,
          name: 'Living Room Thermostat',
          currentTemperature: 720, // 72.0°F in DeciFahrenheit
          currentSetPoint: [
            { type: 'Cool', temperature: 750 }, // 75.0°F
            { type: 'Heat', temperature: 680 }, // 68.0°F
          ],
          currentMode: 'Cool',
        },
      },
      displayName: 'Living Room Thermostat',
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
    };

    thermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
  });

  describe('constructor', () => {
    it('should initialize with correct Crestron ID', () => {
      expect(thermostat.crestronId).toBe(101);
    });

    it('should set up accessory information', () => {
      const infoService = mockAccessory.getService(mockPlatform.Service.AccessoryInformation);
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        mockPlatform.Characteristic.Manufacturer,
        'Crestron Electronics',
      );
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        mockPlatform.Characteristic.Model,
        'Default-Model',
      );
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        mockPlatform.Characteristic.SerialNumber,
        'Crestron-101',
      );
    });

    it('should initialize temperature from device context', () => {
      const currentTemp = thermostat.getCurrentTemperature();
      // 720 DeciFahrenheit = 72°F = 22.2°C
      expect(currentTemp).toBeCloseTo(22.2, 1);
    });

    it('should initialize target temperature from cool setpoint', () => {
      const targetTemp = thermostat.getTargetTemperature();
      // 750 DeciFahrenheit = 75°F = 23.9°C
      expect(targetTemp).toBeCloseTo(23.9, 1);
    });

    it('should initialize heating/cooling states from current mode', () => {
      const currentState = thermostat.getCurrentHeatingCoolingState();
      const targetState = thermostat.getTargetHeatingCoolingState();
      expect(currentState).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.COOL);
      expect(targetState).toBe(mockPlatform.Characteristic.TargetHeatingCoolingState.COOL);
    });

    it('should set valid values for target heating cooling state', () => {
      const service = mockAccessory.getService(mockPlatform.Service.Thermostat);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.TargetHeatingCoolingState);
      expect(characteristic.setProps).toHaveBeenCalledWith({
        validValues: [
          mockPlatform.Characteristic.TargetHeatingCoolingState.OFF,
          mockPlatform.Characteristic.TargetHeatingCoolingState.HEAT,
          mockPlatform.Characteristic.TargetHeatingCoolingState.COOL,
          mockPlatform.Characteristic.TargetHeatingCoolingState.AUTO,
        ],
      });
    });

    it('should set temperature range properties', () => {
      const service = mockAccessory.getService(mockPlatform.Service.Thermostat);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.TargetTemperature);
      expect(characteristic.setProps).toHaveBeenCalledWith({
        minValue: 10,
        maxValue: 32,
        minStep: 0.5,
      });
    });
  });

  describe('temperature getters', () => {
    it('should return current temperature', () => {
      const temp = thermostat.getCurrentTemperature();
      expect(temp).toBeCloseTo(22.2, 1);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Current Temperature for:',
        'Living Room Thermostat',
        expect.any(Number),
      );
    });

    it('should return target temperature', () => {
      const temp = thermostat.getTargetTemperature();
      expect(temp).toBeCloseTo(23.9, 1);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Target Temperature for:',
        'Living Room Thermostat',
        expect.any(Number),
      );
    });
  });

  describe('heating/cooling state getters', () => {
    it('should return current heating cooling state', () => {
      const state = thermostat.getCurrentHeatingCoolingState();
      expect(state).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.COOL);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Current Heating Cooling State for:',
        'Living Room Thermostat',
        mockPlatform.Characteristic.CurrentHeatingCoolingState.COOL,
      );
    });

    it('should return target heating cooling state', () => {
      const state = thermostat.getTargetHeatingCoolingState();
      expect(state).toBe(mockPlatform.Characteristic.TargetHeatingCoolingState.COOL);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Target Heating Cooling State for:',
        'Living Room Thermostat',
        mockPlatform.Characteristic.TargetHeatingCoolingState.COOL,
      );
    });
  });

  describe('temperature display units', () => {
    it('should return temperature display units', () => {
      const units = thermostat.getTemperatureDisplayUnits();
      expect(units).toBe(1); // Fahrenheit
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Temperature Display Units for:',
        'Living Room Thermostat',
        1,
      );
    });

    it('should set temperature display units', async () => {
      await thermostat.setTemperatureDisplayUnits(0); // Celsius
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Set Temperature Display Units ->',
        0,
        '(display only)',
      );
    });
  });

  describe('setTargetTemperature', () => {
    it('should set target temperature for cool mode', async () => {
      // Set mode to COOL first
      await thermostat.setTargetHeatingCoolingState(mockPlatform.Characteristic.TargetHeatingCoolingState.COOL);
      
      // Set temperature to 24°C (75.2°F = 752 DeciFahrenheit)
      await thermostat.setTargetTemperature(24);
      
      expect(mockPlatform.crestronClient.setThermostatSetPoint).toHaveBeenCalledWith({
        id: 101,
        setpoints: [{
          type: 'Cool',
          temperature: 752, // 24°C converted to DeciFahrenheit
        }],
      });
    });

    it('should set target temperature for heat mode', async () => {
      // Set mode to HEAT first
      await thermostat.setTargetHeatingCoolingState(mockPlatform.Characteristic.TargetHeatingCoolingState.HEAT);
      
      // Set temperature to 20°C (68°F = 680 DeciFahrenheit)
      await thermostat.setTargetTemperature(20);
      
      expect(mockPlatform.crestronClient.setThermostatSetPoint).toHaveBeenCalledWith({
        id: 101,
        setpoints: [{
          type: 'Heat',
          temperature: 680, // 20°C converted to DeciFahrenheit
        }],
      });
    });

    it('should set target temperature for auto mode', async () => {
      // Set mode to AUTO first
      await thermostat.setTargetHeatingCoolingState(mockPlatform.Characteristic.TargetHeatingCoolingState.AUTO);
      
      await thermostat.setTargetTemperature(22);
      
      expect(mockPlatform.crestronClient.setThermostatSetPoint).toHaveBeenCalledWith({
        id: 101,
        setpoints: [{
          type: 'Auto',
          temperature: 716, // 22°C converted to DeciFahrenheit
        }],
      });
    });
  });

  describe('setTargetHeatingCoolingState', () => {
    it('should set heating mode', async () => {
      await thermostat.setTargetHeatingCoolingState(mockPlatform.Characteristic.TargetHeatingCoolingState.HEAT);
      
      expect(mockPlatform.crestronClient.setThermostatMode).toHaveBeenCalledWith({
        id: 101,
        mode: 'HEAT',
      });
    });

    it('should set cooling mode', async () => {
      await thermostat.setTargetHeatingCoolingState(mockPlatform.Characteristic.TargetHeatingCoolingState.COOL);
      
      expect(mockPlatform.crestronClient.setThermostatMode).toHaveBeenCalledWith({
        id: 101,
        mode: 'COOL',
      });
    });

    it('should set auto mode', async () => {
      await thermostat.setTargetHeatingCoolingState(mockPlatform.Characteristic.TargetHeatingCoolingState.AUTO);
      
      expect(mockPlatform.crestronClient.setThermostatMode).toHaveBeenCalledWith({
        id: 101,
        mode: 'AUTO',
      });
    });

    it('should set off mode', async () => {
      await thermostat.setTargetHeatingCoolingState(mockPlatform.Characteristic.TargetHeatingCoolingState.OFF);
      
      expect(mockPlatform.crestronClient.setThermostatMode).toHaveBeenCalledWith({
        id: 101,
        mode: 'OFF',
      });
    });
  });

  describe('updateState', () => {
    it('should update current temperature', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 101,
        currentTemperature: 780, // 78°F
      };

      thermostat.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.Thermostat);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.CurrentTemperature);
      expect(characteristic.updateValue).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should update target temperature from cool setpoint', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 101,
        currentSetPoint: [
          { type: 'Cool', temperature: 760 }, // 76°F
        ],
      };

      thermostat.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.Thermostat);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.TargetTemperature);
      expect(characteristic.updateValue).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should update target temperature from heat setpoint when no cool setpoint', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 101,
        currentSetPoint: [
          { type: 'Heat', temperature: 650 }, // 65°F
        ],
      };

      thermostat.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.Thermostat);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.TargetTemperature);
      expect(characteristic.updateValue).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should update heating/cooling states from current mode', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 101,
        currentMode: 'Heat',
      };

      thermostat.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.Thermostat);
      const currentStateChar = service.getCharacteristic(mockPlatform.Characteristic.CurrentHeatingCoolingState);
      const targetStateChar = service.getCharacteristic(mockPlatform.Characteristic.TargetHeatingCoolingState);
      
      expect(currentStateChar.updateValue).toHaveBeenCalledWith(mockPlatform.Characteristic.CurrentHeatingCoolingState.HEAT);
      expect(targetStateChar.updateValue).toHaveBeenCalledWith(mockPlatform.Characteristic.TargetHeatingCoolingState.HEAT);
    });
  });

  describe('temperature conversion', () => {
    it('should correctly convert DeciFahrenheit to Celsius', () => {
      // Test with known conversions
      // 720 DeciFahrenheit = 72°F = 22.22°C
      mockAccessory.context.device.currentTemperature = 720;
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentTemperature()).toBeCloseTo(22.2, 1);
    });

    it('should correctly convert Celsius to DeciFahrenheit', async () => {
      // 25°C = 77°F = 770 DeciFahrenheit
      await thermostat.setTargetTemperature(25);
      
      expect(mockPlatform.crestronClient.setThermostatSetPoint).toHaveBeenCalledWith({
        id: 101,
        setpoints: [{
          type: 'Cool',
          temperature: 770,
        }],
      });
    });
  });

  describe('mode conversion', () => {
    it('should correctly convert Crestron "OFF" to HomeKit', () => {
      mockAccessory.context.device.currentMode = 'OFF';
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentHeatingCoolingState()).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.OFF);
      expect(newThermostat.getTargetHeatingCoolingState()).toBe(mockPlatform.Characteristic.TargetHeatingCoolingState.OFF);
    });

    it('should correctly convert Crestron "HEAT" to HomeKit', () => {
      mockAccessory.context.device.currentMode = 'HEAT';
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentHeatingCoolingState()).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.HEAT);
      expect(newThermostat.getTargetHeatingCoolingState()).toBe(mockPlatform.Characteristic.TargetHeatingCoolingState.HEAT);
    });

    it('should correctly convert Crestron "COOL" to HomeKit', () => {
      mockAccessory.context.device.currentMode = 'COOL';
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentHeatingCoolingState()).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.COOL);
      expect(newThermostat.getTargetHeatingCoolingState()).toBe(mockPlatform.Characteristic.TargetHeatingCoolingState.COOL);
    });

    it('should correctly convert Crestron "AUTO" to HomeKit', () => {
      mockAccessory.context.device.currentMode = 'AUTO';
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentHeatingCoolingState()).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.OFF);
      expect(newThermostat.getTargetHeatingCoolingState()).toBe(mockPlatform.Characteristic.TargetHeatingCoolingState.AUTO);
    });

    it('should handle case insensitive mode conversion', () => {
      mockAccessory.context.device.currentMode = 'heat';
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentHeatingCoolingState()).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.HEAT);
    });

    it('should default to OFF for unknown mode', () => {
      mockAccessory.context.device.currentMode = 'UNKNOWN';
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentHeatingCoolingState()).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.OFF);
    });
  });

  describe('initialization with missing data', () => {
    it('should handle missing current temperature', () => {
      delete mockAccessory.context.device.currentTemperature;
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentTemperature()).toBeCloseTo(22.2, 1); // Default 720 DeciFahrenheit
    });

    it('should handle missing setpoints', () => {
      delete mockAccessory.context.device.currentSetPoint;
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getTargetTemperature()).toBeCloseTo(22.2, 1); // Default 720 DeciFahrenheit
    });

    it('should handle empty setpoints array', () => {
      mockAccessory.context.device.currentSetPoint = [];
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getTargetTemperature()).toBeCloseTo(22.2, 1); // Default 720 DeciFahrenheit
    });

    it('should handle missing current mode', () => {
      delete mockAccessory.context.device.currentMode;
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getCurrentHeatingCoolingState()).toBe(mockPlatform.Characteristic.CurrentHeatingCoolingState.OFF);
      expect(newThermostat.getTargetHeatingCoolingState()).toBe(mockPlatform.Characteristic.TargetHeatingCoolingState.OFF);
    });

    it('should prefer heat setpoint when only heat is available', () => {
      mockAccessory.context.device.currentSetPoint = [
        { type: 'Heat', temperature: 680 }, // 68°F
      ];
      const newThermostat = new CrestronHomeThermostat(mockPlatform, mockAccessory);
      expect(newThermostat.getTargetTemperature()).toBeCloseTo(20.0, 1); // 680 DeciFahrenheit = 68°F = 20°C
    });
  });
});
