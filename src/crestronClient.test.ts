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
});