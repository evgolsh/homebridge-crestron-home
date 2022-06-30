import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { CrestronHomeShade } from './CrestronHomeShade';
import { CrestronHomeLight } from './CrestronHomeLight';
import { CrestronHomeScene } from './CrestronHomeScene';


import { CrestronClient, CrestronDevice } from './crestronClient';

export interface CrestronAccessory{
  crestronId: number;
  updateState(device: CrestronDevice): void;
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
  private enabledTypes: string[] = [];
  private updateInterval: number = 30 * 1000;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  private crestronDevices: CrestronAccessory[] = [];


  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    log.debug('Configured devices:', config.enabledTypes);
    this.enabledTypes = config.enabledTypes;
    this.crestronClient = new CrestronClient(config.crestronHost, config.token, log);
    this.updateInterval = (config.updateInterval || 30) * 1000;
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();

      log.debug('Will update devices every ms:', this.updateInterval);
      setInterval(this.updateDevices.bind(this), this.updateInterval);
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

    const crestronDevices = await this.crestronClient.getDevices() || [];
    //this.log.debug(crestronDevices);

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of crestronDevices) {

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
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        // new CrestronHomePlatformAccessory(this, existingAccessory);
        this.createCrestronAccessory(existingAccessory);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        // create a new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        // new CrestronHomePlatformAccessory(this, accessory);
        if(this.createCrestronAccessory(accessory)){
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      }
    }
  }

  createCrestronAccessory(accessory: PlatformAccessory): boolean {

    const deviceType = accessory.context.device.type;

    if (!this.enabledTypes.includes(accessory.context.device.type)) {
      this.log.info('Device support is not enabled for:', deviceType);
      return false;
    }

    this.log.info('Adding new accessory:', accessory.displayName);
    switch (deviceType) {
      case 'Dimmer':  // Dimmer needs brightness, while Switch has On/Off only
      case 'Switch':
        this.crestronDevices.push(new CrestronHomeLight(this, accessory));
        break;
      case 'Shade':
        this.crestronDevices.push(new CrestronHomeShade(this, accessory));
        break;
      case 'Scene':
        this.crestronDevices.push(new CrestronHomeScene(this, accessory));
        break;
      default:
        this.log.info('Unsupported accessory type:', accessory.context.device.type);
        break;
    }

    return true;
  }

  async updateDevices(){
    const devices = await this.crestronClient.getDevices() || [];

    for (const device of devices) {
      const existingDevice = this.crestronDevices.find(accessory => accessory.crestronId === device.id);

      if(existingDevice){
        existingDevice.updateState(device);
      } else{
        this.log.debug('New device discovered:', device.name);
        const uuid = this.api.hap.uuid.generate(device.id.toString());
        const accessory = new this.api.platformAccessory(device.name, uuid);
        accessory.context.device = device;

        if(this.createCrestronAccessory(accessory)){
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }

      }

    }
  }
}