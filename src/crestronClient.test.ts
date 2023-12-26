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
    mockAxios.onGet('/devices').reply(200, { devices: [{ id: 201, name: 'Device 1', type: 'SubType', roomId: 1,
      level: 50, status: true }] });
    mockAxios.onGet('/shades').reply(200, { shades: [] });

    const devices = await client.getDevices([ 'SceneType', 'SubType', 'Shade', 'Scene']);

    const expectedDevices = [
      { id: 201, level: 50, name: 'Living Room Device 1', position: 0, roomId: 1, roomName: 'Living Room',
        status: true, subType: 'SubType', type: 'SubType' },
      { id: 101, level: 0, name: 'Living Room Scene 1', position: 0, roomId: 1, roomName: 'Living Room',
        status: true, subType: 'SceneType', type: 'Scene' },
    ];

    expect(devices).toEqual(expectedDevices);
  });
});
