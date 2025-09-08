import { CrestronHomeLight } from '../src/CrestronHomeLight';

// Simple unit tests for CrestronHomeLight utility functions
describe('CrestronHomeLight', () => {
  let light: CrestronHomeLight;
  let mockPlatform: any;
  let mockAccessory: any;

  beforeEach(() => {
    mockPlatform = {
      Service: {
        AccessoryInformation: function() { return this; },
        Lightbulb: function() { return this; },
      },
      Characteristic: {
        Manufacturer: { UUID: 'manufacturer' },
        Model: { UUID: 'model' },
        SerialNumber: { UUID: 'serial' },
        Name: { UUID: 'name' },
        On: { UUID: 'on' },
        Brightness: { UUID: 'brightness' },
      },
      crestronClient: {
        setLightsState: jest.fn(),
      },
      log: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const mockService = {
      setCharacteristic: jest.fn().mockReturnThis(),
      getCharacteristic: jest.fn().mockReturnValue({
        onSet: jest.fn().mockReturnThis(),
        onGet: jest.fn().mockReturnThis(),
        updateValue: jest.fn().mockReturnThis(),
      }),
    };

    mockAccessory = {
      context: {
        device: {
          id: 123,
          name: 'Test Light',
          roomName: 'Living Room',
          roomId: 1,
          type: 'Light',
          subType: 'Dimmer',
          level: 32768,
          status: true,
          position: 0,
        },
      },
      displayName: 'Living Room Test Light',
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
    };

    light = new CrestronHomeLight(mockPlatform, mockAccessory);
  });

  describe('utility functions', () => {
    it('should convert Crestron range values to percentage', () => {
      expect(light.crestronRangeValueToPercentage(0)).toBe(0);
      expect(light.crestronRangeValueToPercentage(32768)).toBe(50);
      expect(light.crestronRangeValueToPercentage(65535)).toBe(100);
    });

    it('should convert percentage to Crestron range values', () => {
      expect(light.percentageToCrestronRangeValue(0)).toBe(0);
      expect(light.percentageToCrestronRangeValue(50)).toBe(32768);
      expect(light.percentageToCrestronRangeValue(100)).toBe(65535);
    });

    it('should have correct crestron ID', () => {
      expect(light.crestronId).toBe(123);
    });
  });

  describe('HomeKit integration', () => {
    it('should call setLightsState when turning on', async () => {
      await light.setLightsState(true);
      expect(mockPlatform.crestronClient.setLightsState).toHaveBeenCalledWith([{
        id: 123,
        level: 65535,
        time: 0,
      }]);
    });

    it('should call setLightsState when turning off', async () => {
      await light.setLightsState(false);
      expect(mockPlatform.crestronClient.setLightsState).toHaveBeenCalledWith([{
        id: 123,
        level: 0,
        time: 0,
      }]);
    });

    it('should call setLightsState when setting brightness', async () => {
      await light.setBrightness(75);
      expect(mockPlatform.crestronClient.setLightsState).toHaveBeenCalledWith([{
        id: 123,
        level: 49151, // 75% of 65535
        time: 0,
      }]);
    });
  });
});
