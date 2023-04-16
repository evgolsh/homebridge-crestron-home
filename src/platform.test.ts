import { API, Logger, PlatformConfig } from 'homebridge';
import { CrestronHomePlatform } from '../src/platform';
import { CrestronClient } from '../src/crestronClient';
import { mockDeep } from 'jest-mock-extended';

const mockedLogger = mockDeep<Logger>();

const mockedAPI: API = {
  hap: {
    uuid: {
      generate: jest.fn(),
    },
  },
  platformAccessory: jest.fn(),
  on: jest.fn(),
} as unknown as API;

const mockedCrestronClient = new CrestronClient('192.168.1.2', 'apiToken', mockedLogger);
jest.mock('../src/crestronClient');

const config: PlatformConfig = {
  crestronHost: 'http://localhost',
  token: 'test_token',
  platform: 'test_platform',
  // Add any other properties you need for your tests
};

describe('CrestronHomePlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should call getDevices on CrestronClient when discoverDevices is called', async () => {
    const platform = new CrestronHomePlatform(mockedLogger, config, mockedAPI);
    platform.crestronClient = mockedCrestronClient;

    mockedCrestronClient.getDevices = jest.fn().mockResolvedValue([]);

    await platform.discoverDevices();

    expect(mockedCrestronClient.getDevices).toHaveBeenCalledTimes(1);
  });

  test('should call getDevices on CrestronClient when updateDevices is called', async () => {
    const platform = new CrestronHomePlatform(mockedLogger, config, mockedAPI);
    platform.crestronClient = mockedCrestronClient;

    mockedCrestronClient.getDevices = jest.fn().mockResolvedValue([]);

    await platform.updateDevices();

    expect(mockedCrestronClient.getDevices).toHaveBeenCalledTimes(1);
  });

  // Add more tests as needed.
});
