import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { CrestronHomePlatformAccessory } from './platformAccessory';

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';

type LightState = {
  id: number;
  level: number;
  time: number;
};

type ShadeState = {
  id: number;
  position: number;
};

class CrestronClient {
  private axiosClient!: AxiosInstance;
  private apiToken: string;
  private crestronUri: string;
  private authKey = '';
  private httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  constructor(
    crestronHost: string,
    apiToken: string,
    public readonly log: Logger) {

    this.apiToken = apiToken;

    this.log.debug('Configured Crestron Processor, trying to login to;', crestronHost);
    this.crestronUri = `https://${crestronHost}/cws/api`;
  }

  public async getDevices() {
    this.log.debug('Start discovering devices...');

    try {
      const response = await this.axiosClient.get('/devices');

      //this.log.debug('Get Devices response: ', response);
      return response.data.devices;
    } catch (error) {
      this.log.error('error getting devices: ', error);
    }

  }

  public async getDevice(id: number) {

    try {
      const response = await this.axiosClient.get(`/devices/${id}`);

      //this.log.debug('Get Device state:', response.data.devices);
      return response.data.devices[0];

    } catch (error) {
      this.log.error('error getting lights state: ', error);
    }
  }

  public async getShadeState(id: number){

    try {
      const response = await this.axiosClient.get(`/Shades/${id}`);

      //this.log.debug('Get Device state:', response.data.devices);
      return response.data.shades[0];

    } catch (error) {
      this.log.error('error getting lights state: ', error);
    }
  }

  public async setShadesState(shades: ShadeState[]) {

    const shadesState = { shades: shades };
    //this.log.debug('Setting lights state:', lightsState);

    try {
      const response = await this.axiosClient.post(
        '/Shades/SetState',
        shadesState,
      );

      this.log.debug('Shades state changed successfully: ', response.data);
    } catch (error) {
      this.log.error('Error setting Shades state');
    }
  }

  public async setLightsState(lights: LightState[]) {

    const lightsState = { lights: lights };
    //this.log.debug('Setting lights state:', lightsState);

    try {
      const response = await this.axiosClient.post(
        '/Lights/SetState',
        lightsState,
      );

      this.log.debug('Lights state changed successfully: ', response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.log.error('error changing lights state: ', error.message);
        return error.message;
      } else {
        this.log.error('Unexpected error changing lights state: ', error);
        return 'An unexpected error occurred while tried to login to Crestron';
      }
    }
  }

  public async login() {

    this.log.debug('Starting login...');
    try {
      const response = await axios.get(
        '/login',
        {
          httpsAgent: this.httpsAgent,
          baseURL: this.crestronUri,
          headers: {
            Accept: 'application/json',
            'Crestron-RestAPI-AuthToken': this.apiToken,
          },
        },
      );

      this.log.debug('Succsessfully authinticated, working with version: ', response.data.version);

      const config: AxiosRequestConfig = {
        httpsAgent: this.httpsAgent,
        baseURL: this.crestronUri,
        headers: {
          'Crestron-RestAPI-AuthKey': response.data.authkey,
        },
      };

      this.axiosClient = axios.create(
        config,
      );
    } catch (error) {

      if (axios.isAxiosError(error)) {
        this.log.error('Login error: ', error.message);
        return error.message;
      } else {
        this.log.error('Login unexpected error: ', error);
        return 'An unexpected error occurred while tried to login to Crestron';
      }
    }
  }
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class CrestronHomePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public crestronClient: CrestronClient;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    this.crestronClient = new CrestronClient(config.crestronHost, config.token, log);
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }



  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {

    // EXAMPLE ONLY
    // A real plugin you would discover accessories from the local network, cloud services
    // or a user-defined array in the platform config.

    await this.crestronClient.login();

    const exampleDevices = await this.crestronClient.getDevices();
    this.log.debug(JSON.stringify(exampleDevices));

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of exampleDevices) {

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.id.toString());

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new CrestronHomePlatformAccessory(this, existingAccessory);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new CrestronHomePlatformAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
