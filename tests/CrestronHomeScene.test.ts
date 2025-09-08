import { CrestronHomeScene } from '../src/CrestronHomeScene';

describe('CrestronHomeScene', () => {
  let scene: CrestronHomeScene;
  let mockPlatform: any;
  let mockAccessory: any;

  beforeEach(() => {
    mockPlatform = {
      Service: {
        AccessoryInformation: function() { return this; },
        Switch: function() { return this; },
        LockMechanism: function() { return this; },
      },
      Characteristic: {
        Manufacturer: { UUID: 'manufacturer' },
        Model: { UUID: 'model' },
        SerialNumber: { UUID: 'serial' },
        Name: { UUID: 'name' },
        On: { UUID: 'on' },
        LockCurrentState: {
          UUID: 'lockCurrent',
          SECURED: 1,
        },
        LockTargetState: { UUID: 'lockTarget' },
      },
      crestronClient: {
        recallScene: jest.fn(),
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
          id: 789,
          name: 'Test Scene',
          roomName: 'Living Room',
          roomId: 1,
          type: 'Scene',
          subType: 'Scene',
          level: 0,
          status: false,
          position: 0,
        },
      },
      displayName: 'Living Room Test Scene',
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
    };

    scene = new CrestronHomeScene(mockPlatform, mockAccessory);
  });

  describe('constructor - Switch type scene', () => {
    it('should initialize with correct device properties', () => {
      expect(scene.crestronId).toBe(789);
      expect(mockAccessory.getService).toHaveBeenCalled();
    });

    it('should set up switch service for default scene type', () => {
      expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.Switch);
    });
  });

  describe('constructor - genericIO type scene', () => {
    it('should set up lock mechanism for genericIO subtype', () => {
      // Create new scene with genericIO subtype
      const genericIODevice = {
        ...mockAccessory.context.device,
        subType: 'genericIO',
      };
      mockAccessory.context.device = genericIODevice;

      const genericIOScene = new CrestronHomeScene(mockPlatform, mockAccessory);

      expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.LockMechanism);
      expect(genericIOScene.crestronId).toBe(789);
    });
  });

  describe('utility functions', () => {
    it('should convert Crestron range values to percentage', () => {
      expect(scene.crestronRangeValueToPercentage(0)).toBe(0);
      expect(scene.crestronRangeValueToPercentage(32768)).toBe(50);
      expect(scene.crestronRangeValueToPercentage(65535)).toBe(100);
    });

    it('should convert percentage to Crestron range values', () => {
      expect(scene.percentageToCrestronRangeValue(0)).toBe(0);
      expect(scene.percentageToCrestronRangeValue(50)).toBe(32768);
      expect(scene.percentageToCrestronRangeValue(100)).toBe(65535);
    });
  });

  describe('scene state management', () => {
    it('should return current scene state', () => {
      const state = scene.getSceneState();
      expect(state).toBe(false); // Initial state from mock device
    });

    it('should toggle scene state when recalled', async () => {
      const initialState = scene.getSceneState();
      expect(initialState).toBe(false);

      await scene.recallScene(true);
      
      expect(mockPlatform.crestronClient.recallScene).toHaveBeenCalledWith(789);
      
      // State should be toggled
      const newState = scene.getSceneState();
      expect(newState).toBe(true);
    });

    it('should update scene state from device', () => {
      const mockDevice = {
        id: 789,
        name: 'Test Scene',
        roomName: 'Living Room',
        roomId: 1,
        type: 'Scene',
        subType: 'Scene',
        level: 0,
        status: true, // Updated status
        position: 0,
      };

      scene.updateState(mockDevice);

      expect(scene.getSceneState()).toBe(true);
    });

    it('should not update characteristic for genericIO scenes', () => {
      const genericIODevice = {
        ...mockAccessory.context.device,
        subType: 'genericIO',
        status: true,
      };

      scene.updateState(genericIODevice);

      // Should still update internal state
      expect(scene.getSceneState()).toBe(true);
    });
  });

  describe('lock mechanism for genericIO', () => {
    it('should return SECURED for lock current state', () => {
      const lockState = scene.getLockCurrentState();
      expect(lockState).toBe(1); // SECURED
    });
  });

  describe('scene recall behavior', () => {
    it('should toggle from false to true', async () => {
      // Start with false state
      expect(scene.getSceneState()).toBe(false);

      await scene.recallScene(true);
      
      expect(scene.getSceneState()).toBe(true);
      expect(mockPlatform.crestronClient.recallScene).toHaveBeenCalledWith(789);
    });

    it('should toggle from true to false', async () => {
      // First set to true
      await scene.recallScene(true);
      expect(scene.getSceneState()).toBe(true);

      // Then toggle back to false
      await scene.recallScene(false);
      
      expect(scene.getSceneState()).toBe(false);
      expect(mockPlatform.crestronClient.recallScene).toHaveBeenCalledTimes(2);
    });
  });
});
