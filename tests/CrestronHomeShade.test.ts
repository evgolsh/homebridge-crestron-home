import { CrestronHomeShade } from '../src/CrestronHomeShade';

describe('CrestronHomeShade', () => {
  let shade: CrestronHomeShade;
  let mockPlatform: any;
  let mockAccessory: any;

  beforeEach(() => {
    mockPlatform = {
      Service: {
        AccessoryInformation: function() { return this; },
        WindowCovering: function() { return this; },
      },
      Characteristic: {
        Manufacturer: { UUID: 'manufacturer' },
        Model: { UUID: 'model' },
        SerialNumber: { UUID: 'serial' },
        Name: { UUID: 'name' },
        CurrentPosition: { UUID: 'currentPos' },
        TargetPosition: { UUID: 'targetPos' },
        PositionState: { 
          UUID: 'posState',
          STOPPED: 0,
          DECREASING: 1,
          INCREASING: 2,
        },
      },
      crestronClient: {
        setShadesState: jest.fn(),
        getShadeState: jest.fn().mockResolvedValue({ position: 32768 }),
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
          id: 456,
          name: 'Test Shade',
          roomName: 'Living Room',
          roomId: 1,
          type: 'Shade',
          subType: 'Shade',
          level: 0,
          status: true,
          position: 32768, // 50% position
        },
      },
      displayName: 'Living Room Test Shade',
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
    };

    shade = new CrestronHomeShade(mockPlatform, mockAccessory);
  });

  describe('utility functions', () => {
    it('should convert Crestron range values to percentage', () => {
      expect(shade.crestronRangeValueToPercentage(0)).toBe(0);
      expect(shade.crestronRangeValueToPercentage(32768)).toBe(50);
      expect(shade.crestronRangeValueToPercentage(65535)).toBe(100);
    });

    it('should convert percentage to Crestron range values', () => {
      expect(shade.percentageToCrestronRangeValue(0)).toBe(0);
      expect(shade.percentageToCrestronRangeValue(50)).toBe(32768);
      expect(shade.percentageToCrestronRangeValue(100)).toBe(65535);
    });

    it('should have correct crestron ID', () => {
      expect(shade.crestronId).toBe(456);
    });
  });

  describe('HomeKit integration', () => {
    it('should call setShadesState when setting target position', async () => {
      await shade.setShadeTargetPosition(75);
      
      expect(mockPlatform.crestronClient.setShadesState).toHaveBeenCalledWith([{
        id: 456,
        position: 49151, // 75% of 65535
      }]);
    });

    it('should return current position', () => {
      const position = shade.getShadeCurrentPosition();
      expect(position).toBe(50); // Initial 50% position from mock device
    });

    it('should return target position', () => {
      const position = shade.getShadeTargetPosition();
      expect(position).toBe(50); // Initial 50% position from mock device
    });

    it('should return position state', () => {
      const state = shade.getShadePositionState();
      expect(state).toBe(0); // STOPPED
    });
  });

  describe('state management', () => {
    it('should update current and target positions from device', () => {
      const mockDevice = {
        id: 456,
        name: 'Test Shade',
        roomName: 'Living Room',
        roomId: 1,
        type: 'Shade',
        subType: 'Shade',
        level: 0,
        status: true,
        position: 65535, // 100% position
      };

      shade.updateState(mockDevice);

      expect(shade.getShadeCurrentPosition()).toBe(100);
      expect(shade.getShadeTargetPosition()).toBe(100); // Should match current when stopped
    });

    it('should set position state to INCREASING when target > current', async () => {
      // Set current position to a lower value
      shade.updateState({
        ...mockAccessory.context.device,
        position: 16384, // 25%
      });

      // Set target to higher value
      await shade.setShadeTargetPosition(75);

      expect(shade.getShadePositionState()).toBe(2); // INCREASING
    });

    it('should set position state to DECREASING when target < current', async () => {
      // Set current position to a higher value
      shade.updateState({
        ...mockAccessory.context.device,
        position: 49151, // 75%
      });

      // Set target to lower value
      await shade.setShadeTargetPosition(25);

      expect(shade.getShadePositionState()).toBe(1); // DECREASING
    });
  });
});
