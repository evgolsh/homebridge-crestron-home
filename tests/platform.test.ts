import { API, Logger, PlatformConfig, PlatformAccessory } from 'homebridge';
import { CrestronHomePlatform } from '../src/platform';
import { CrestronClient, CrestronDevice } from '../src/crestronClient';
import { mockDeep } from 'jest-mock-extended';

const mockedLogger = mockDeep<Logger>();

const mockedAPI: API = {
  hap: {
    uuid: {
      generate: jest.fn().mockReturnValue('test-uuid'),
    },
    Service: {} as any,
    Characteristic: {} as any,
  },
  platformAccessory: jest.fn() as any,
  on: jest.fn(),
  updatePlatformAccessories: jest.fn(),
  registerPlatformAccessories: jest.fn(),
  unregisterPlatformAccessories: jest.fn(),
} as unknown as API;

// Mock the CrestronClient
jest.mock('../src/crestronClient');
const MockedCrestronClient = CrestronClient as jest.MockedClass<typeof CrestronClient>;

const baseConfig: PlatformConfig = {
  crestronHost: 'http://localhost',
  token: 'test_token',
  platform: 'test_platform',
  name: 'Test Platform',
  enabledTypes: ['Light', 'Shade'],
  updateInterval: 60,
};

describe('CrestronHomePlatform', () => {
  let mockCrestronClient: jest.Mocked<CrestronClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh mock for each test
    mockCrestronClient = {
      getDevices: jest.fn(),
    } as any;
    MockedCrestronClient.mockImplementation(() => mockCrestronClient);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      
      expect(platform.enabledTypes).toEqual(['Light', 'Shade']);
      expect(platform.updateInterval).toBe(60000); // 60 seconds in milliseconds
      expect(platform.accessories).toEqual([]);
      expect(MockedCrestronClient).toHaveBeenCalledWith('http://localhost', 'test_token', mockedLogger);
    });

    it('should use default update interval when not provided', () => {
      const configWithoutInterval = { ...baseConfig };
      delete configWithoutInterval.updateInterval;
      
      const platform = new CrestronHomePlatform(mockedLogger, configWithoutInterval, mockedAPI);
      
      expect(platform.updateInterval).toBe(30000); // Default 30 seconds
    });

    it('should register didFinishLaunching callback', () => {
      new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      
      expect(mockedAPI.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
    });
  });

  describe('configureAccessory', () => {
    it('should add accessory to cache and log info', () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      const mockAccessory = {
        displayName: 'Test Accessory',
        UUID: 'test-uuid',
        context: { device: { id: 1, name: 'Test' } },
      } as unknown as PlatformAccessory;

      platform.configureAccessory(mockAccessory);

      expect(platform.accessories).toContain(mockAccessory);
      expect(mockedLogger.info).toHaveBeenCalledWith('Loading accessory from cache:', 'Test Accessory');
    });
  });

  describe('discoverDevices', () => {
    it('should call getDevices with enabled types', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      mockCrestronClient.getDevices.mockResolvedValue([]);

      await platform.discoverDevices();

      expect(mockCrestronClient.getDevices).toHaveBeenCalledWith(['Light', 'Shade']);
    });

    it('should warn and truncate when more than 149 devices found', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      const manyDevices = Array(150).fill(null).map((_, i) => ({
        id: i,
        name: `Device ${i}`,
        type: 'Light',
        subType: 'Light',
        roomId: 1,
        roomName: 'Room',
        status: false,
        level: 0,
        position: 0,
      }));
      
      mockCrestronClient.getDevices.mockResolvedValue(manyDevices);
      // Mock platformAccessory to return an object with context property
      (mockedAPI.platformAccessory as any).mockImplementation((name: string) => ({
        displayName: name,
        context: {},
      }));

      await platform.discoverDevices();

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Found more than 149 devices, Homebridge will crash - truncating to 149 !!!'
      );
    });

    it('should register new accessory when not in cache', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      const testDevice: CrestronDevice = {
        id: 1,
        name: 'Test Light',
        type: 'Light',
        subType: 'Light',
        roomId: 1,
        roomName: 'Living Room',
        status: true,
        level: 80,
        position: 0,
      };
      
      mockCrestronClient.getDevices.mockResolvedValue([testDevice]);
      const mockAccessory = { 
        displayName: 'Test Light',
        context: {},
      };
      (mockedAPI.platformAccessory as any).mockReturnValue(mockAccessory);

      await platform.discoverDevices();

      expect(mockedAPI.platformAccessory).toHaveBeenCalledWith('Test Light', 'test-uuid');
      expect(mockedAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        'homebridge-crestron-home',
        'CrestronHomePlatform',
        [mockAccessory]
      );
      expect(platform.accessories).toContain(mockAccessory);
    });

    it('should restore existing accessory from cache', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      const testDevice: CrestronDevice = {
        id: 1,
        name: 'Test Light',
        type: 'Light',
        subType: 'Light',
        roomId: 1,
        roomName: 'Living Room',
        status: true,
        level: 80,
        position: 0,
      };
      
      // Add existing accessory to cache
      const existingAccessory = {
        UUID: 'test-uuid',
        displayName: 'Test Light',
        context: { device: { id: 1, name: 'Old Test Light' } },
      } as unknown as PlatformAccessory;
      platform.accessories.push(existingAccessory);
      
      mockCrestronClient.getDevices.mockResolvedValue([testDevice]);

      await platform.discoverDevices();

      expect(mockedLogger.info).toHaveBeenCalledWith('Restoring existing accessory from cache:', 'Test Light');
      expect(existingAccessory.context.device).toEqual(testDevice);
      expect(mockedAPI.updatePlatformAccessories).toHaveBeenCalledWith([existingAccessory]);
      expect(mockedAPI.registerPlatformAccessories).not.toHaveBeenCalled(); // Should not register again
    });
  });

  describe('createCrestronAccessory', () => {
    let platform: CrestronHomePlatform;
    
    beforeEach(() => {
      platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
    });

    it('should handle unsupported accessory type', () => {
      const mockAccessory = {
        displayName: 'Test Unknown',
        context: { device: { type: 'UnknownType' } },
      } as unknown as PlatformAccessory;

      const result = platform.createCrestronAccessory(mockAccessory);

      expect(result).toBe(true);
      expect(mockedLogger.info).toHaveBeenCalledWith('Adding new accessory:', 'Test Unknown');
      expect(mockedLogger.info).toHaveBeenCalledWith('Unsupported accessory type:', 'UnknownType');
    });
  });

  describe('updateDevices', () => {
    it('should call getDevices with enabled types', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      mockCrestronClient.getDevices.mockResolvedValue([]);

      await platform.updateDevices();

      expect(mockCrestronClient.getDevices).toHaveBeenCalledWith(['Light', 'Shade']);
      expect(mockedLogger.info).toHaveBeenCalledWith('Updating Devices state');
    });

    it('should update existing device state', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      const testDevice: CrestronDevice = {
        id: 1,
        name: 'Test Light',
        type: 'Light',
        subType: 'Light',
        roomId: 1,
        roomName: 'Living Room',
        status: true,
        level: 80,
        position: 0,
      };

      // Mock device in crestronDevices array
      const mockCrestronAccessory = {
        crestronId: 1,
        updateState: jest.fn(),
      };
      (platform as any).crestronDevices = [mockCrestronAccessory];
      
      mockCrestronClient.getDevices.mockResolvedValue([testDevice]);

      await platform.updateDevices();

      expect(mockCrestronAccessory.updateState).toHaveBeenCalledWith(testDevice);
    });

    it('should restore cached accessory during update when not in crestronDevices', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      const testDevice: CrestronDevice = {
        id: 1,
        name: 'Test Light',
        type: 'Light',
        subType: 'Light',
        roomId: 1,
        roomName: 'Living Room',
        status: true,
        level: 80,
        position: 0,
      };

      // Add existing accessory to cache but not to crestronDevices
      const existingAccessory = {
        UUID: 'test-uuid',
        displayName: 'Test Light',
        context: { device: { id: 1, name: 'Old Test Light' } },
      } as unknown as PlatformAccessory;
      platform.accessories.push(existingAccessory);
      
      mockCrestronClient.getDevices.mockResolvedValue([testDevice]);

      await platform.updateDevices();

      expect(mockedLogger.info).toHaveBeenCalledWith('Restoring existing accessory from cache:', 'Test Light');
      expect(existingAccessory.context.device).toEqual(testDevice);
      expect(mockedAPI.updatePlatformAccessories).toHaveBeenCalledWith([existingAccessory]);
    });

    it('should create new device when not found in cache or crestronDevices', async () => {
      const platform = new CrestronHomePlatform(mockedLogger, baseConfig, mockedAPI);
      const testDevice: CrestronDevice = {
        id: 1,
        name: 'Test Light',
        type: 'Light',
        subType: 'Light',
        roomId: 1,
        roomName: 'Living Room',
        status: true,
        level: 80,
        position: 0,
      };
      
      mockCrestronClient.getDevices.mockResolvedValue([testDevice]);
      const mockAccessory = { 
        displayName: 'Test Light',
        context: {},
      };
      (mockedAPI.platformAccessory as any).mockReturnValue(mockAccessory);

      await platform.updateDevices();

      expect(mockedLogger.debug).toHaveBeenCalledWith('New device discovered:', 'Test Light');
      expect(mockedAPI.platformAccessory).toHaveBeenCalledWith('Test Light', 'test-uuid');
      expect(mockedAPI.registerPlatformAccessories).toHaveBeenCalledWith(
        'homebridge-crestron-home',
        'CrestronHomePlatform',
        [mockAccessory]
      );
      expect(platform.accessories).toContain(mockAccessory);
    });
  });
});
