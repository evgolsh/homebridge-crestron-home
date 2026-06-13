import { CrestronClient } from '../src/crestronClient';
import { Logger } from 'homebridge';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mockAxios = new MockAdapter(axios);

describe('CrestronClient', () => {
  let client: CrestronClient;
  let log: Logger;

  beforeEach(() => {
    log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger;
    client = new CrestronClient('localhost', 'api-token', log);

    // Reset the mockAxios state before each test
    mockAxios.reset();
  });

  it('should get devices', async () => {
    // Mock the login response
    mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });

    // Mock the other API calls
    mockAxios.onGet('/rooms').reply(200, { rooms: [{ id: 1, name: 'Living Room' }] });
    mockAxios.onGet('/scenes').reply(200, { scenes: [{ id: 101, name: 'Scene 1', type: 'SceneType', roomId: 1, status: true }] });
    mockAxios.onGet('/devices').reply(200, {
      devices: [{
        id: 201, name: 'Device 1', type: 'SubType', roomId: 1,
        level: 50, status: true,
      }],
    });
    mockAxios.onGet('/shades').reply(200, { shades: [] });
    mockAxios.onGet('/thermostats').reply(200, { thermostats: [] });

    const devices = await client.getDevices(['SceneType', 'SubType', 'Shade', 'Scene']);

    const expectedDevices = [
      {
        id: 201, level: 50, name: 'Living Room Device 1', position: 0, roomId: 1, roomName: 'Living Room',
        status: true, subType: 'SubType', type: 'SubType',
        currentTemperature: undefined, currentMode: undefined, currentFanMode: undefined,
        currentSetPoint: undefined, temperatureUnits: undefined, schedulerState: undefined,
        availableFanModes: undefined, availableSystemModes: undefined, connectionStatus: undefined,
      },
      {
        id: 101, level: 0, name: 'Living Room Scene 1', position: 0, roomId: 1, roomName: 'Living Room',
        status: true, subType: 'SceneType', type: 'Scene',
        currentTemperature: undefined, currentMode: undefined, currentFanMode: undefined,
        currentSetPoint: undefined, temperatureUnits: undefined, schedulerState: undefined,
        availableFanModes: undefined, availableSystemModes: undefined, connectionStatus: undefined,
      },
    ];

    expect(devices).toEqual(expectedDevices);
  });

  it('should treat Drape subType as Shade (issue #20)', async () => {
    mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
    mockAxios.onGet('/rooms').reply(200, { rooms: [{ id: 1, name: 'Living Room' }] });
    mockAxios.onGet('/scenes').reply(200, { scenes: [] });
    mockAxios.onGet('/devices').reply(200, {
      devices: [{ id: 301, name: 'Curtain', type: 'Shade', subType: 'Drape', roomId: 1, status: true }],
    });
    mockAxios.onGet('/shades').reply(200, { shades: [{ id: 301, position: 32768, subType: 'Drape' }] });
    mockAxios.onGet('/thermostats').reply(200, { thermostats: [] });

    const devices = await client.getDevices(['Shade']);

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      id: 301, type: 'Shade', subType: 'Shade', name: 'Living Room Curtain', position: 32768,
    });
  });

  it('should return [] and not throw when login fails (issue #21)', async () => {
    mockAxios.onGet('/login').reply(500);

    const devices = await client.getDevices(['Shade']);

    expect(devices).toEqual([]);
    expect(log.error).toHaveBeenCalled();
  });

  it('should get thermostat devices', async () => {
    // Mock the login response
    mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });

    // Mock the API calls with thermostat data
    mockAxios.onGet('/rooms').reply(200, { rooms: [{ id: 1, name: 'Living Room' }] });
    mockAxios.onGet('/scenes').reply(200, { scenes: [] });
    mockAxios.onGet('/devices').reply(200, {
      devices: [{
        id: 301, name: 'Thermostat 1', type: 'Thermostat', roomId: 1,
        level: 0, status: false,
      }],
    });
    mockAxios.onGet('/shades').reply(200, { shades: [] });
    mockAxios.onGet('/thermostats').reply(200, {
      thermostats: [{
        id: 301, currentTemperature: 720, currentMode: 'Cool', currentFanMode: 'Auto',
        currentSetPoint: [{ type: 'cool', temperature: 700 }], temperatureUnits: 'DeciFahrenheit',
        schedulerState: 'run', availableFanModes: ['Auto', 'On'], availableSystemModes: ['Off', 'Cool', 'Heat'],
        connectionStatus: 'online',
      }],
    });

    const devices = await client.getDevices(['Thermostat']);

    const expectedDevices = [
      {
        id: 301, level: 0, name: 'Living Room Thermostat 1', position: 0, roomId: 1, roomName: 'Living Room',
        status: false, subType: 'Thermostat', type: 'Thermostat',
        currentTemperature: 720, currentMode: 'Cool', currentFanMode: 'Auto',
        currentSetPoint: [{ type: 'cool', temperature: 700 }], temperatureUnits: 'DeciFahrenheit',
        schedulerState: 'run', availableFanModes: ['Auto', 'On'], availableSystemModes: ['Off', 'Cool', 'Heat'],
        connectionStatus: 'online',
      },
    ];

    expect(devices).toEqual(expectedDevices);
  });

  it('should get door lock devices', async () => {
    // Mock the login response
    mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });

    // Mock the API calls with door lock data
    mockAxios.onGet('/rooms').reply(200, { rooms: [{ id: 1, name: 'Living Room' }] });
    mockAxios.onGet('/scenes').reply(200, { scenes: [] });
    mockAxios.onGet('/devices').reply(200, {
      devices: [{
        id: 401, name: 'Front Door', type: 'lock', roomId: 1,
        level: 0, status: false,
      }],
    });
    mockAxios.onGet('/shades').reply(200, { shades: [] });
    mockAxios.onGet('/thermostats').reply(200, { thermostats: [] });
    mockAxios.onGet('/doorlocks').reply(200, {
      doorLocks: [{
        id: 401, name: 'Front Door', status: 'locked', type: 'lock',
        connectionStatus: 'online', roomId: 1,
      }],
    });

    const devices = await client.getDevices(['DoorLock']);

    const expectedDevices = [
      {
        id: 401, level: 0, name: 'Living Room Front Door', position: 0, roomId: 1, roomName: 'Living Room',
        status: true, subType: 'lock', type: 'DoorLock',
        lockStatus: 'locked', lockType: 'lock', connectionStatus: 'online',
        currentTemperature: undefined, currentMode: undefined, currentFanMode: undefined,
        currentSetPoint: undefined, temperatureUnits: undefined, schedulerState: undefined,
        availableFanModes: undefined, availableSystemModes: undefined,
      },
    ];

    expect(devices).toEqual(expectedDevices);
  });

  describe('setLightsState', () => {
    it('should set lights state successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/lights').reply(200, { success: true });

      const lightStates = [{ id: 123, level: 32768, time: 0 }];
      await client.setLightsState(lightStates);

      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify({ lights: lightStates }));
    });

    it('should handle error when setting lights state', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/lights').reply(500);

      const lightStates = [{ id: 123, level: 32768, time: 0 }];
      await client.setLightsState(lightStates);

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('setShadesState', () => {
    it('should set shades state successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/shades').reply(200, { success: true });

      const shadeStates = [{ id: 456, position: 50 }];
      await client.setShadesState(shadeStates);

      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify({ shades: shadeStates }));
    });
  });

  describe('setThermostatSetPoint', () => {
    it('should set thermostat setpoint successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/thermostats/SetPoint').reply(200, { success: true });

      const setPointData = {
        id: 301,
        setpoints: [{ type: 'Cool' as const, temperature: 720 }]
      };
      await client.setThermostatSetPoint(setPointData);

      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify(setPointData));
    });

    it('should handle error when setting thermostat setpoint', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/thermostats/SetPoint').reply(500);

      const setPointData = {
        id: 301,
        setpoints: [{ type: 'Cool' as const, temperature: 720 }]
      };
      await client.setThermostatSetPoint(setPointData);

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('setThermostatMode', () => {
    it('should set thermostat mode successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/thermostats/mode').reply(200, { success: true });

      const modeData = { id: 301, mode: 'COOL' as const };
      await client.setThermostatMode(modeData);

      expect(mockAxios.history.post).toHaveLength(1);
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({ thermostats: [modeData] });
    });
  });

  describe('lockDoor and unlockDoor', () => {
    it('should lock door successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/doorlocks/lock/401').reply(200, { success: true });

      const result = await client.lockDoor(401);

      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe('/doorlocks/lock/401');
      expect(result).toEqual({ success: true });
    });

    it('should unlock door successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/doorlocks/unlock/401').reply(200, { success: true });

      const result = await client.unlockDoor(401);

      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe('/doorlocks/unlock/401');
      expect(result).toEqual({ success: true });
    });

    it('should handle error when locking door', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/doorlocks/lock/401').reply(500);

      await client.lockDoor(401);

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('setSecuritySystemState', () => {
    it('should set security system state successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/securitydevices/501').reply(200, { success: true });

      const securityStateData = { id: 501, state: 'ArmAway' as const };
      await client.setSecuritySystemState(securityStateData);

      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe('/securitydevices/501');
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual({ state: 'ArmAway' });
    });

    it('should handle error when setting security system state', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onPost('/securitydevices/501').reply(500);

      const securityStateData = { id: 501, state: 'ArmAway' as const };
      
      await expect(client.setSecuritySystemState(securityStateData))
        .rejects.toThrow();

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login successfully and create axios client', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'test-auth-key', version: '2.0.0' });

      const loginTime = await client.login();

      expect(loginTime).toBeGreaterThan(0);
      expect(log.info).toHaveBeenCalledWith(
        'Succsessfully authinticated, working with version: ',
        '2.0.0'
      );
    });

    it('should reuse existing session if still valid', async () => {
      // First login
      mockAxios.onGet('/login').reply(200, { authkey: 'test-auth-key', version: '2.0.0' });
      const firstLogin = await client.login();

      // Second login attempt immediately after
      mockAxios.resetHistory();
      const secondLogin = await client.login();

      expect(firstLogin).toBe(secondLogin);
      expect(mockAxios.history.get).toHaveLength(0); // No new login request
    });

    it('should handle login error gracefully', async () => {
      mockAxios.onGet('/login').reply(401, { error: 'Unauthorized' });

      const loginTime = await client.login();

      expect(loginTime).toBeLessThan(Date.now());
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('getThermostatState', () => {
    it('should get thermostat state successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      const thermostatData = {
        id: 301,
        currentTemperature: 720,
        currentMode: 'Cool'
      };
      mockAxios.onGet('/thermostats/301').reply(200, { thermostats: [thermostatData] });

      const result = await client.getThermostatState(301);

      expect(result).toEqual(thermostatData);
    });

    it('should handle error when getting thermostat state', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onGet('/thermostats/301').reply(500);

      await client.getThermostatState(301);

      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('getDoorLockState', () => {
    it('should get door lock state successfully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      const doorLockData = {
        id: 401,
        status: 'locked'
      };
      mockAxios.onGet('/doorlocks/401').reply(200, { doorLocks: [doorLockData] });

      const result = await client.getDoorLockState(401);

      expect(result).toEqual(doorLockData);
    });
  });

  describe('error handling for missing API endpoints', () => {
    it('should handle missing doorlocks endpoint gracefully', async () => {
      mockAxios.onGet('/login').reply(200, { authkey: 'auth-key', version: '1.0.0' });
      mockAxios.onGet('/rooms').reply(200, { rooms: [] });
      mockAxios.onGet('/scenes').reply(200, { scenes: [] });
      mockAxios.onGet('/devices').reply(200, { devices: [] });
      mockAxios.onGet('/shades').reply(200, { shades: [] });
      mockAxios.onGet('/thermostats').reply(200, { thermostats: [] });
      mockAxios.onGet('/doorlocks').reply(404);
      mockAxios.onGet('/securitydevices').reply(404);

      const devices = await client.getDevices(['DoorLock', 'SecuritySystem']);

      expect(devices).toEqual([]);
      // Should not throw error despite 404 responses
    });
  });
});
