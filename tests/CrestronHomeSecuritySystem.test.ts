import { CrestronHomeSecuritySystem } from '../src/CrestronHomeSecuritySystem';
import { CrestronDevice } from '../src/crestronClient';

describe('CrestronHomeSecuritySystem', () => {
  let securitySystem: CrestronHomeSecuritySystem;
  let mockPlatform: any;
  let mockAccessory: any;

  beforeEach(() => {
    mockPlatform = {
      Service: {
        AccessoryInformation: function() { return this; },
        SecuritySystem: function() { return this; },
      },
      Characteristic: {
        Manufacturer: { UUID: 'manufacturer' },
        Model: { UUID: 'model' },
        SerialNumber: { UUID: 'serial' },
        Name: { UUID: 'name' },
        SecuritySystemCurrentState: {
          STAY_ARM: 0,
          AWAY_ARM: 1,
          NIGHT_ARM: 2,
          DISARMED: 3,
          ALARM_TRIGGERED: 4,
        },
        SecuritySystemTargetState: {
          STAY_ARM: 0,
          AWAY_ARM: 1,
          NIGHT_ARM: 2,
          DISARM: 3,
        },
        SecuritySystemAlarmType: { UUID: 'alarmType' },
        StatusFault: { UUID: 'statusFault' },
      },
      crestronClient: {
        setSecuritySystemState: jest.fn(),
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
          name: 'Home Security System',
          securityCurrentState: 'Disarmed',
          connectionStatus: 'online',
        },
      },
      displayName: 'Home Security System',
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
    };

    securitySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
  });

  describe('constructor', () => {
    it('should initialize with correct Crestron ID', () => {
      expect(securitySystem.crestronId).toBe(789);
    });

    it('should set up accessory information', () => {
      const infoService = mockAccessory.getService(mockPlatform.Service.AccessoryInformation);
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        mockPlatform.Characteristic.Manufacturer,
        'Crestron Electronics',
      );
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        mockPlatform.Characteristic.Model,
        'Security System',
      );
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        mockPlatform.Characteristic.SerialNumber,
        'Crestron-Security-789',
      );
    });

    it('should initialize security states from device context', () => {
      const currentState = securitySystem.getSecuritySystemCurrentState();
      expect(currentState).toBe(mockPlatform.Characteristic.SecuritySystemCurrentState.DISARMED);
    });

    it('should initialize connection status', () => {
      const statusFault = securitySystem.getStatusFault();
      expect(statusFault).toBe(0); // online = no fault
    });
  });

  describe('getSecuritySystemCurrentState', () => {
    it('should return current security state', () => {
      const state = securitySystem.getSecuritySystemCurrentState();
      expect(state).toBe(mockPlatform.Characteristic.SecuritySystemCurrentState.DISARMED);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Security System Current State for:',
        'Home Security System',
        mockPlatform.Characteristic.SecuritySystemCurrentState.DISARMED,
      );
    });
  });

  describe('getSecuritySystemTargetState', () => {
    it('should return target security state', () => {
      const state = securitySystem.getSecuritySystemTargetState();
      expect(state).toBe(mockPlatform.Characteristic.SecuritySystemTargetState.DISARM);
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Security System Target State for:',
        'Home Security System',
        mockPlatform.Characteristic.SecuritySystemTargetState.DISARM,
      );
    });
  });

  describe('getSecuritySystemAlarmType', () => {
    it('should return alarm type', () => {
      const alarmType = securitySystem.getSecuritySystemAlarmType();
      expect(alarmType).toBe(0); // No alarm
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Security System Alarm Type for:',
        'Home Security System',
        0,
      );
    });
  });

  describe('getStatusFault', () => {
    it('should return status fault', () => {
      const statusFault = securitySystem.getStatusFault();
      expect(statusFault).toBe(0); // No fault
      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        'Get Status Fault for:',
        'Home Security System',
        0,
      );
    });
  });

  describe('setSecuritySystemTargetState', () => {
    it('should disarm the security system', async () => {
      await securitySystem.setSecuritySystemTargetState(mockPlatform.Characteristic.SecuritySystemTargetState.DISARM);
      
      expect(mockPlatform.crestronClient.setSecuritySystemState).toHaveBeenCalledWith({
        id: 789,
        state: 'Disarmed',
      });
      expect(mockPlatform.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Setting security system "Home Security System" to: Disarmed'),
      );
    });

    it('should arm stay the security system', async () => {
      await securitySystem.setSecuritySystemTargetState(mockPlatform.Characteristic.SecuritySystemTargetState.STAY_ARM);
      
      expect(mockPlatform.crestronClient.setSecuritySystemState).toHaveBeenCalledWith({
        id: 789,
        state: 'ArmStay',
      });
    });

    it('should arm away the security system', async () => {
      await securitySystem.setSecuritySystemTargetState(mockPlatform.Characteristic.SecuritySystemTargetState.AWAY_ARM);
      
      expect(mockPlatform.crestronClient.setSecuritySystemState).toHaveBeenCalledWith({
        id: 789,
        state: 'ArmAway',
      });
    });

    it('should arm night (instant) the security system', async () => {
      await securitySystem.setSecuritySystemTargetState(mockPlatform.Characteristic.SecuritySystemTargetState.NIGHT_ARM);
      
      expect(mockPlatform.crestronClient.setSecuritySystemState).toHaveBeenCalledWith({
        id: 789,
        state: 'ArmInstant',
      });
    });

    it('should handle errors and reset target state', async () => {
      const error = new Error('Connection failed');
      mockPlatform.crestronClient.setSecuritySystemState.mockRejectedValue(error);

      await expect(
        securitySystem.setSecuritySystemTargetState(mockPlatform.Characteristic.SecuritySystemTargetState.AWAY_ARM),
      ).rejects.toThrow('Connection failed');

      expect(mockPlatform.log.error).toHaveBeenCalledWith(
        '❌ SECURITY: Failed to set security system state:',
        error,
      );
    });
  });

  describe('updateState', () => {
    it('should update security system state', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 789,
        securityCurrentState: 'ArmAway',
        connectionStatus: 'online',
      };

      securitySystem.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.SecuritySystem);
      const currentStateCharacteristic = service.getCharacteristic(mockPlatform.Characteristic.SecuritySystemCurrentState);
      expect(currentStateCharacteristic.updateValue).toHaveBeenCalledWith(
        mockPlatform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      );

      const targetStateCharacteristic = service.getCharacteristic(mockPlatform.Characteristic.SecuritySystemTargetState);
      expect(targetStateCharacteristic.updateValue).toHaveBeenCalledWith(
        mockPlatform.Characteristic.SecuritySystemTargetState.AWAY_ARM,
      );
    });

    it('should update alarm type when in alarm state', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 789,
        securityCurrentState: 'Alarm',
        connectionStatus: 'online',
      };

      securitySystem.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.SecuritySystem);
      const alarmTypeCharacteristic = service.getCharacteristic(mockPlatform.Characteristic.SecuritySystemAlarmType);
      expect(alarmTypeCharacteristic.updateValue).toHaveBeenCalledWith(1); // Unknown alarm type
    });

    it('should update alarm type when in fire state', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 789,
        securityCurrentState: 'Fire',
        connectionStatus: 'online',
      };

      securitySystem.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.SecuritySystem);
      const alarmTypeCharacteristic = service.getCharacteristic(mockPlatform.Characteristic.SecuritySystemAlarmType);
      expect(alarmTypeCharacteristic.updateValue).toHaveBeenCalledWith(1); // Unknown alarm type
    });

    it('should update connection status fault', () => {
      const updatedDevice: Partial<CrestronDevice> = {
        id: 789,
        securityCurrentState: 'Disarmed',
        connectionStatus: 'offline',
      };

      securitySystem.updateState(updatedDevice as CrestronDevice);

      const service = mockAccessory.getService(mockPlatform.Service.SecuritySystem);
      const statusFaultCharacteristic = service.getCharacteristic(mockPlatform.Characteristic.StatusFault);
      expect(statusFaultCharacteristic.updateValue).toHaveBeenCalledWith(1); // offline = fault
    });
  });

  describe('crestronStateToHomeKit conversion', () => {
    it('should correctly convert "Disarmed" state', () => {
      mockAccessory.context.device.securityCurrentState = 'Disarmed';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.DISARMED,
      );
    });

    it('should correctly convert "ArmStay" state', () => {
      mockAccessory.context.device.securityCurrentState = 'ArmStay';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.STAY_ARM,
      );
    });

    it('should correctly convert "ArmAway" state', () => {
      mockAccessory.context.device.securityCurrentState = 'ArmAway';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      );
    });

    it('should correctly convert "ArmInstant" state to Night Arm', () => {
      mockAccessory.context.device.securityCurrentState = 'ArmInstant';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM,
      );
    });

    it('should correctly convert "Alarm" state', () => {
      mockAccessory.context.device.securityCurrentState = 'Alarm';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED,
      );
    });

    it('should correctly convert "Fire" state', () => {
      mockAccessory.context.device.securityCurrentState = 'Fire';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED,
      );
    });

    it('should correctly convert "EntryDelay" state', () => {
      mockAccessory.context.device.securityCurrentState = 'EntryDelay';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      );
    });

    it('should correctly convert "ExitDelay" state', () => {
      mockAccessory.context.device.securityCurrentState = 'ExitDelay';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      );
    });

    it('should default to DISARMED for unknown state', () => {
      mockAccessory.context.device.securityCurrentState = 'UnknownState';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.DISARMED,
      );
      expect(mockPlatform.log.warn).toHaveBeenCalledWith(
        'Unknown Crestron security state:',
        'UnknownState',
        '- defaulting to Disarmed',
      );
    });

    it('should handle case insensitive state conversion', () => {
      mockAccessory.context.device.securityCurrentState = 'armaway';
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      );
    });
  });

  describe('initialization without security state', () => {
    it('should handle missing security state gracefully', () => {
      delete mockAccessory.context.device.securityCurrentState;
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getSecuritySystemCurrentState()).toBe(
        mockPlatform.Characteristic.SecuritySystemCurrentState.DISARMED,
      );
    });

    it('should handle missing connection status gracefully', () => {
      delete mockAccessory.context.device.connectionStatus;
      const newSecuritySystem = new CrestronHomeSecuritySystem(mockPlatform, mockAccessory);
      expect(newSecuritySystem.getStatusFault()).toBe(0); // No fault by default
    });
  });
});
