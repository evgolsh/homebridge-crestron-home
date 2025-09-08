import { Logger } from 'homebridge';
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

type ThermostatSetPoint = {
  id: number;
  setpoints: Array<{
    type: 'Cool' | 'Heat' | 'Auto';
    temperature: number;
  }>;
};

type ThermostatMode = {
  id: number;
  mode: 'HEAT' | 'COOL' | 'AUTO' | 'OFF';
};

type ThermostatFanMode = {
  id: number;
  mode: 'AUTO' | 'ON';
};

type SecuritySystemState = {
  id: number;
  state: 'Disarmed' | 'ArmStay' | 'ArmAway' | 'ArmInstant';
};


type Room = {
  id: number;
  name: string;
};

interface ThermostatData {
  currentTemperature?: number; // In DeciFahrenheit (720 = 72.0°F)
  currentMode?: string; // 'Cool', 'Heat', 'Auto', 'Off'
  currentFanMode?: string; // 'Auto', 'On'
  currentSetPoint?: Array<{ type: string; temperature: number }>; // Cool/Heat setpoints
  temperatureUnits?: string; // 'DeciFahrenheit' or 'FahrenheitWholeDegrees'
  schedulerState?: string; // 'run', 'hold'
  availableFanModes?: string[];
  availableSystemModes?: string[];
  connectionStatus?: string;
}

interface DoorLockData {
  status?: string;
  type?: string;
  connectionStatus?: string;
}

interface SecurityDeviceData {
  availableStates?: string[]; // e.g., ["Alarm", "ArmAway", "ArmInstant", "ArmStay", "Disarmed", "EntryDelay", "ExitDelay", "Fire"]
  currentState?: string; // e.g., "Disarmed", "ArmAway", "Alarm", etc.
  connectionStatus?: string;
  roomId?: number;
}

type Scene = {
  id: number;
  name: string;
  type: string;
  roomId: number;
  status: boolean;
};

export interface CrestronDevice {
  id: number;
  name: string;
  type: string;
  subType: string;
  roomId: number;
  roomName: string;
  status: boolean;
  level: number;
  position: number;
  // Thermostat-specific properties (match actual API response)
  currentTemperature?: number; // In DeciFahrenheit (720 = 72.0°F)
  currentMode?: string; // 'Cool', 'Heat', 'Auto', 'Off'
  currentFanMode?: string; // 'Auto', 'On'
  currentSetPoint?: Array<{ type: string; temperature: number }>; // Cool/Heat setpoints
  temperatureUnits?: string; // 'DeciFahrenheit' or 'FahrenheitWholeDegrees'
  schedulerState?: string; // 'run', 'hold'
  availableFanModes?: string[];
  availableSystemModes?: string[];
  connectionStatus?: string;
  // Door lock-specific properties
  lockStatus?: string; // 'locked', 'unlocked', 'jammed', etc.
  lockType?: string;
  // Security system-specific properties
  securityCurrentState?: string; // 'Disarmed', 'ArmAway', 'ArmStay', 'Alarm', 'Fire', etc.
  securityAvailableStates?: string[]; // Available security states
}

export class CrestronClient {
  private axiosClient!: AxiosInstance;
  private apiToken: string;
  private crestronUri: string;
  private lastLogin: number = new Date().getTime() - 11 * 60 * 1000; // 11 minutes, Crestron session TTL is 10 minutes
  private NINE_MINUTES_MILLIS = 9 * 60 * 1000;

  private httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  private rooms: Room[] = [];


  constructor(
    crestronHost: string,
    apiToken: string,
    public readonly log: Logger) {

    this.apiToken = apiToken;

    this.log.debug('Configured Crestron Processor, trying to login to;', crestronHost);
    this.crestronUri = `https://${crestronHost}/cws/api`;
  }

  public async getDevices(enabledTypes: string[]) {
    this.log.debug('Start discovering devices...');

    const devices: CrestronDevice[] = [];

    try {
      await this.login();

      const crestronData = await Promise.all([
        this.axiosClient.get('/rooms'),
        this.axiosClient.get('/scenes'),
        this.axiosClient.get('/devices'),
        this.axiosClient.get('/shades'),
        this.axiosClient.get('/thermostats'),
        this.axiosClient.get('/doorlocks').catch(() => ({ data: { doorLocks: [] } })), // Handle if endpoint doesn't exist
        this.axiosClient.get('/securitydevices').catch(() => ({ data: { securityDevices: [] } })), // Handle if endpoint doesn't exist
      ]);

      this.rooms = crestronData[0].data.rooms;

      // Debug logging for device discovery
      this.log.info('🔍 DEVICE DISCOVERY SUMMARY:');
      this.log.info('- Total devices:', crestronData[2].data.devices?.length || 0);
      this.log.info('- Total thermostats from API:', crestronData[4].data.thermostats?.length || 0);
      this.log.info('- Total scenes:', crestronData[1].data.scenes?.length || 0);
      this.log.info('- Total shades:', crestronData[3].data.shades?.length || 0);
      this.log.info('- Total security devices from API:', crestronData[6].data.securityDevices?.length || 0);
      this.log.info('- Enabled types in config:', enabledTypes.join(', '));


      for (const device of crestronData[2].data.devices) {

        const roomName = this.rooms.find(r => r.id === device.roomId)?.name;
        const deviceType = device.subType || device.type;
        let shadePosition = 0;
        let thermostatData: ThermostatData | null = null;
        let doorLockData: DoorLockData | null = null;
        let securityDeviceData: SecurityDeviceData | null = null;

        // Debug logging for each device
        if (deviceType === 'Thermostat' || deviceType === 'thermostat') {
          this.log.info(`🌡️ Found thermostat device: ID=${device.id}, name="${device.name}", room="${roomName}", type="${deviceType}"`);
        }
        if (deviceType === 'security Device') {
          this.log.info(`🔒 Found security device: ID=${device.id}, name="${device.name}", room="${roomName}", type="${deviceType}"`);
        }

        if (deviceType === 'Shade') {
          shadePosition = crestronData[3].data.shades.find(sh => sh.id === device.id)?.position;
        }

        if (deviceType === 'Thermostat' || deviceType === 'thermostat') {
          thermostatData = crestronData[4].data.thermostats?.find(th => th.id === device.id);
          this.log.debug(`Thermostat matching: deviceID=${device.id}, foundThermostatData=${!!thermostatData}`);
          if (thermostatData) {
            this.log.debug('Thermostat data:', JSON.stringify(thermostatData, null, 2));
          }
        }

        if (deviceType === 'DoorLock' || deviceType === 'lock') {
          doorLockData = crestronData[5].data.doorLocks?.find(dl => dl.id === device.id);
        }

        if (deviceType === 'security Device') {
          securityDeviceData = crestronData[6].data.securityDevices?.find(sd => sd.id === device.id);
          this.log.info(`🔒 Security device matching: deviceID=${device.id}, foundSecurityData=${!!securityDeviceData}`);
          if (securityDeviceData) {
            this.log.info('🔒 Security device data:', JSON.stringify(securityDeviceData, null, 2));
          }
        }

        const d: CrestronDevice = {
          id: device.id,
          type: deviceType,
          subType: deviceType,
          name: `${roomName} ${device.name}`, // Name is "Room Name Device Name"
          roomId: device.roomId,
          roomName: roomName || '',
          level: device.level || 0,
          status: device.status || false,
          position: shadePosition || 0,
          // Map actual thermostat API response to our interface
          currentTemperature: thermostatData?.currentTemperature,
          currentMode: thermostatData?.currentMode,
          currentFanMode: thermostatData?.currentFanMode,
          currentSetPoint: thermostatData?.currentSetPoint,
          temperatureUnits: thermostatData?.temperatureUnits,
          schedulerState: thermostatData?.schedulerState,
          availableFanModes: thermostatData?.availableFanModes,
          availableSystemModes: thermostatData?.availableSystemModes,
          connectionStatus: thermostatData?.connectionStatus || doorLockData?.connectionStatus,
          // Map door lock API response to our interface
          lockStatus: doorLockData?.status,
          lockType: doorLockData?.type,
          // Map security device API response to our interface
          securityCurrentState: securityDeviceData?.currentState,
          securityAvailableStates: securityDeviceData?.availableStates,
        };

        // Check if device type is enabled (handle special cases)
        const isEnabled = enabledTypes.includes(deviceType) ||
          (deviceType === 'thermostat' && enabledTypes.includes('Thermostat')) ||
          (deviceType === 'security Device' && enabledTypes.includes('SecuritySystem'));
        if (isEnabled) {
          devices.push(d);
          if (deviceType === 'Thermostat' || deviceType === 'thermostat') {
            this.log.info(`✅ Added thermostat to devices list: ${d.name}`);
          }
          if (deviceType === 'security Device') {
            this.log.info(`✅ Added security device to devices list: ${d.name}`);
          }
        } else if (deviceType === 'Thermostat' || deviceType === 'thermostat') {
          this.log.info(`⚠️ Thermostat found but not enabled in config: ${d.name}`);
        } else if (deviceType === 'security Device') {
          this.log.info(`⚠️ Security device found but not enabled in config: ${d.name}`);
        }

      }

      for (const scene of crestronData[1].data.scenes) {

        const roomName = this.rooms.find(r => r.id === scene.roomId)?.name;
        const d: CrestronDevice = {
          id: scene.id,
          type: 'Scene',
          subType: scene.type,
          name: `${roomName} ${scene.name}`, // Name is "Room Name Service Name"
          roomId: scene.roomId,
          roomName: roomName || '',
          level: 0,
          status: scene.status,
          position: 0,
        };

        if (enabledTypes.includes('Scene')) {
          devices.push(d);
        }
      }

      // Handle door locks from /doorlocks endpoint
      for (const doorLock of crestronData[5].data.doorLocks || []) {

        const roomName = this.rooms.find(r => r.id === doorLock.roomId)?.name;
        const d: CrestronDevice = {
          id: doorLock.id,
          type: 'DoorLock',
          subType: doorLock.type,
          name: `${roomName} ${doorLock.name}`, // Name is "Room Name Lock Name"
          roomId: doorLock.roomId,
          roomName: roomName || '',
          level: 0,
          status: doorLock.status === 'locked',
          position: 0,
          // Map door lock properties
          lockStatus: doorLock.status,
          lockType: doorLock.type,
          connectionStatus: doorLock.connectionStatus,
        };

        if (enabledTypes.includes('DoorLock')) {
          devices.push(d);
        }
      }

      // if (devices.length > 149) {
      //   this.log.warn('Returning more than 149 devices, Homebridge may crash - ', devices.length);
      // }

      // this.log.debug('Get Devices response: ', devices);
      return devices;
    } catch (error) {
      this.log.error('error getting devices: ', error);
      return [];
    }
  }

  public async getDevice(id: number) {

    await this.login();

    try {
      const response = await this.axiosClient.get(`/devices/${id}`);

      //this.log.debug('Get Device state:', response.data.devices);
      return response.data.devices[0];

    } catch (error) {
      this.log.error('error getting lights state: ', error);
    }
  }

  public async getShadeState(id: number) {

    await this.login();

    try {
      const response = await this.axiosClient.get(`/Shades/${id}`);

      //this.log.debug('Get Device state:', response.data.devices);
      return response.data.shades[0];

    } catch (error) {
      this.log.error('error getting shades state: ', error);
    }
  }

  public async setShadesState(shades: ShadeState[]) {

    const shadesState = { shades: shades };
    this.log.debug('Setting shades state:', shades);

    await this.login();
    try {
      const response = await this.axiosClient.post(
        '/Shades/SetState',
        shadesState,
      );
      this.log.debug('Shades state changed successfully: ', response.data);
    } catch (error) {
      this.log.error('Error setting Shades state:', error);
    }
  }

  public async setLightsState(lights: LightState[]) {

    const lightsState = { lights: lights };
    //this.log.debug('Setting lights state:', lightsState);

    await this.login();

    try {
      const response = await this.axiosClient.post(
        '/Lights/SetState',
        lightsState,
      );

      this.log.debug('Lights state changed successfully: ', response.data);
    } catch (error) {
      this.log.error('error changing lights state: ', error);
    }
  }

  public async getScene(sceneId: number): Promise<Scene> {

    await this.login();
    try {
      const response = await this.axiosClient.get(`/scenes/${sceneId}`);
      return response.data.scenes[0];
    } catch (error) {
      this.log.error('Unexpected error getting scene state: ', error);
      throw (error);
    }
  }

  public async recallScene(sceneId: number) {

    await this.login();
    try {
      const response = await this.axiosClient.post(
        `/SCENES/RECALL/${sceneId}`,
        '',
      );
      this.log.debug('Succsessfuly recalled scene:', response.data);

      return response.data;
    } catch (error) {
      this.log.error('Unexpected error changing lights state: ', error);
    }
  }

  public async getThermostatState(id: number) {
    await this.login();

    try {
      const response = await this.axiosClient.get(`/thermostats/${id}`);
      this.log.debug('Get Thermostat state:', response.data.thermostats);
      return response.data.thermostats[0];
    } catch (error) {
      this.log.error('Error getting thermostat state: ', error);
    }
  }

  public async setThermostatSetPoint(setPointData: ThermostatSetPoint) {
    this.log.debug('Setting thermostat setpoint:', setPointData);

    await this.login();
    try {
      const response = await this.axiosClient.post(
        '/thermostats/SetPoint',
        setPointData,
      );
      this.log.debug('Thermostat setpoint changed successfully: ', response.data);
    } catch (error) {
      this.log.error('Error setting thermostat setpoint:', error);
    }
  }

  public async setThermostatMode(modeData: ThermostatMode) {
    const payload = {
      thermostats: [modeData],
    };
    this.log.debug('Setting thermostat mode:', payload);

    await this.login();
    try {
      const response = await this.axiosClient.post(
        '/thermostats/mode',
        payload,
      );
      this.log.debug('Thermostat mode changed successfully: ', response.data);
    } catch (error) {
      this.log.error('Error setting thermostat mode:', error);
    }
  }

  public async setThermostatFanMode(fanModeData: ThermostatFanMode) {
    const payload = {
      thermostats: [fanModeData],
    };
    this.log.debug('Setting thermostat fan mode:', payload);

    await this.login();
    try {
      const response = await this.axiosClient.post(
        '/thermostats/fanmode',
        payload,
      );
      this.log.debug('Thermostat fan mode changed successfully: ', response.data);
    } catch (error) {
      this.log.error('Error setting thermostat fan mode:', error);
    }
  }

  public async setSecuritySystemState(securityStateData: SecuritySystemState) {
    this.log.debug('Setting security system state:', securityStateData);
    this.log.info(`🔒 SECURITY API: Changing security system ID ${securityStateData.id} to "${securityStateData.state}"`);

    await this.login();
    try {
      // Based on Crestron API patterns, likely POST to /securitydevices/{id} with state
      // Note: This follows the pattern seen in other Crestron APIs but hasn't been tested
      const response = await this.axiosClient.post(
        `/securitydevices/${securityStateData.id}`,
        {
          state: securityStateData.state,
        },
      );
      this.log.info(`✅ SECURITY API: Security system state changed successfully to "${securityStateData.state}"`);
      this.log.debug('Security system API response:', response.data);
    } catch (error) {
      this.log.error(`❌ SECURITY API: Error setting security system state to "${securityStateData.state}":`, error);
      throw error;
    }
  }

  public async login(): Promise<number> {

    this.log.debug('Starting login...');

    if (new Date().getTime() - this.lastLogin < this.NINE_MINUTES_MILLIS) {
      this.log.debug('LOGIN: Session is still valid, doing nothing...');
      return this.lastLogin;
    }

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

      this.log.info('Succsessfully authinticated, working with version: ', response.data.version);

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

      this.lastLogin = new Date().getTime();
      return this.lastLogin;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.log.error('Login error: ', error.message);
        return this.lastLogin;
      } else {
        this.log.error('Login unexpected error: ', error);
        return this.lastLogin;
      }
    }
  }

  public async getDoorLockState(id: number) {
    await this.login();

    try {
      const response = await this.axiosClient.get(`/doorlocks/${id}`);
      this.log.debug('Get Door Lock state:', response.data.doorLocks);
      return response.data.doorLocks[0];
    } catch (error) {
      this.log.error('Error getting door lock state: ', error);
    }
  }

  public async lockDoor(id: number) {
    this.log.debug('Locking door with ID:', id);

    await this.login();
    try {
      const response = await this.axiosClient.post(`/doorlocks/lock/${id}`);
      this.log.debug('Door locked successfully: ', response.data);
      return response.data;
    } catch (error) {
      this.log.error('Error locking door:', error);
    }
  }

  public async unlockDoor(id: number) {
    this.log.debug('Unlocking door with ID:', id);

    await this.login();
    try {
      const response = await this.axiosClient.post(`/doorlocks/unlock/${id}`);
      this.log.debug('Door unlocked successfully: ', response.data);
      return response.data;
    } catch (error) {
      this.log.error('Error unlocking door:', error);
    }
  }
}
