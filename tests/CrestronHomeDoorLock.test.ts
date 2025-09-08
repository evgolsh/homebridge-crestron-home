import { CrestronHomeDoorLock } from '../src/CrestronHomeDoorLock';
import { CrestronDevice } from '../src/crestronClient';

describe('CrestronHomeDoorLock', () => {
  let doorLock: CrestronHomeDoorLock;
  let mockPlatform: any;
  let mockAccessory: any;

  beforeEach(() => {
    mockPlatform = {
      Service: {
        AccessoryInformation: function() { return this; },
        LockMechanism: function() { return this; },
      },
      Characteristic: {
        Manufacturer: { UUID: 'manufacturer' },
        Model: { UUID: 'model' },
        SerialNumber: { UUID: 'serial' },
        Name: { UUID: 'name' },
        LockCurrentState: {
          UNKNOWN: 0,
          UNSECURED: 1,
          SECURED: 3,
          JAMMED: 2,
        },
        LockTargetState: {
          UNSECURED: 0,
          SECURED: 1,
        },
      },
      crestronClient: {
        lockDoor: jest.fn(),
        unlockDoor: jest.fn(),
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
          name: 'Front Door Lock',
          lockStatus: 'unlocked',
        },
      },
      displayName: 'Front Door Lock',
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
    };

    doorLock = new CrestronHomeDoorLock(mockPlatform, mockAccessory);
  });

  describe('constructor', () => {
    it('should initialize with correct Crestron ID', () => {
      expect(doorLock.crestronId).toBe(456);
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
        'Crestron-456',
      );
    });

    it('should initialize lock states from device context', () => {
      const lockCurrentState = doorLock.getLockCurrentState();
      expect(lockCurrentState).toBe(mockPlatform.Characteristic.LockCurrentState.UNSECURED);
    });
  });

  describe('getLockCurrentState', () => {
    it('should return current lock state', () => {
      const state = doorLock.getLockCurrentState();
      expect(state).toBe(mockPlatform.Characteristic.LockCurrentState.UNSECURED);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Lock Current State for:',
        'Front Door Lock',
        mockPlatform.Characteristic.LockCurrentState.UNSECURED,
      );
    });
  });

  describe('getLockTargetState', () => {
    it('should return target lock state', () => {
      const state = doorLock.getLockTargetState();
      expect(state).toBe(mockPlatform.Characteristic.LockTargetState.UNSECURED);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Lock Target State for:',
        'Front Door Lock',
        mockPlatform.Characteristic.LockTargetState.UNSECURED,
      );
    });
  });

  describe('setLockTargetState', () => {
    it('should lock the door when target state is SECURED', async () => {
      await doorLock.setLockTargetState(mockPlatform.Characteristic.LockTargetState.SECURED);
      
      expect(mockPlatform.crestronClient.lockDoor).toHaveBeenCalledWith(456);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith('Locking door ->', 'Front Door Lock');
    });

    it('should unlock the door when target state is UNSECURED', async () => {
      await doorLock.setLockTargetState(mockPlatform.Characteristic.LockTargetState.UNSECURED);
      
      expect(mockPlatform.crestronClient.unlockDoor).toHaveBeenCalledWith(456);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith('Unlocking door ->', 'Front Door Lock');
    });
  });

  describe('updateState', () => {
    it('should update lock state when device lock status changes', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 456,
        lockStatus: 'locked',
      };

      doorLock.updateState(updatedDevice as CrestronDevice);

      // Verify that updateValue was called on the characteristic
      const service = mockAccessory.getService(mockPlatform.Service.LockMechanism);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.LockCurrentState);
      expect(characteristic.updateValue).toHaveBeenCalledWith(
        mockPlatform.Characteristic.LockCurrentState.SECURED,
      );
    });

    it('should update target state to match current state', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 456,
        lockStatus: 'locked',
      };

      doorLock.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.LockMechanism);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.LockTargetState);
      expect(characteristic.updateValue).toHaveBeenCalledWith(
        mockPlatform.Characteristic.LockTargetState.SECURED,
      );
    });

    it('should handle jammed lock status', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 456,
        lockStatus: 'jammed',
      };

      doorLock.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.LockMechanism);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.LockCurrentState);
      expect(characteristic.updateValue).toHaveBeenCalledWith(
        mockPlatform.Characteristic.LockCurrentState.JAMMED,
      );
    });

    it('should handle unknown lock status', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 456,
        lockStatus: 'unknown',
      };

      doorLock.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.LockMechanism);
      const characteristic = service.getCharacteristic(mockPlatform.Characteristic.LockCurrentState);
      expect(characteristic.updateValue).toHaveBeenCalledWith(
        mockPlatform.Characteristic.LockCurrentState.UNKNOWN,
      );
    });
  });

  describe('crestronStatusToHomeKit conversion', () => {
    it('should correctly convert "locked" status', () => {
      mockAccessory.context.device.lockStatus = 'locked';
      const newDoorLock = new CrestronHomeDoorLock(mockPlatform, mockAccessory);
      expect(newDoorLock.getLockCurrentState()).toBe(mockPlatform.Characteristic.LockCurrentState.SECURED);
    });

    it('should correctly convert "unlocked" status', () => {
      mockAccessory.context.device.lockStatus = 'unlocked';
      const newDoorLock = new CrestronHomeDoorLock(mockPlatform, mockAccessory);
      expect(newDoorLock.getLockCurrentState()).toBe(mockPlatform.Characteristic.LockCurrentState.UNSECURED);
    });

    it('should correctly convert "jammed" status', () => {
      mockAccessory.context.device.lockStatus = 'jammed';
      const newDoorLock = new CrestronHomeDoorLock(mockPlatform, mockAccessory);
      expect(newDoorLock.getLockCurrentState()).toBe(mockPlatform.Characteristic.LockCurrentState.JAMMED);
    });

    it('should default to UNKNOWN for unrecognized status', () => {
      mockAccessory.context.device.lockStatus = 'something_else';
      const newDoorLock = new CrestronHomeDoorLock(mockPlatform, mockAccessory);
      expect(newDoorLock.getLockCurrentState()).toBe(mockPlatform.Characteristic.LockCurrentState.UNKNOWN);
    });

    it('should handle case insensitive status conversion', () => {
      mockAccessory.context.device.lockStatus = 'LOCKED';
      const newDoorLock = new CrestronHomeDoorLock(mockPlatform, mockAccessory);
      expect(newDoorLock.getLockCurrentState()).toBe(mockPlatform.Characteristic.LockCurrentState.SECURED);
    });
  });

  describe('initialization without lock status', () => {
    it('should handle missing lock status gracefully', () => {
      delete mockAccessory.context.device.lockStatus;
      const newDoorLock = new CrestronHomeDoorLock(mockPlatform, mockAccessory);
      expect(newDoorLock.getLockCurrentState()).toBe(mockPlatform.Characteristic.LockCurrentState.UNKNOWN);
    });
  });
});
