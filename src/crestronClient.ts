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

type Room = {
  id: number;
  name: string;
};

type Scene = {
  id: number;
  name: string;
  type: string;
  roomId: number;
  status: boolean;
};

interface Device{
  id: number;
  name: string;
  type: string;
  subType: string;
  roomId: number;
  roomName: string;
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
  private scenes: Scene[] = [];
  private enabledTypes: string[] = [];

  constructor(
    crestronHost: string,
    apiToken: string,
    enabledTypes: Array<string>,
    public readonly log: Logger) {

    this.apiToken = apiToken;
    this.enabledTypes = enabledTypes;

    log.debug('Enabled types:', this.enabledTypes);
    this.log.debug('Configured Crestron Processor, trying to login to;', crestronHost);
    this.crestronUri = `https://${crestronHost}/cws/api`;
  }

  public async getDevices() {
    this.log.debug('Start discovering devices...');
    await this.login();

    const devices: Device[] = [];

    try {
      const crestronData = await Promise.all([
        this.axiosClient.get('/rooms'),
        this.axiosClient.get('/scenes'),
        this.axiosClient.get('/devices'),
      ]);

      this.rooms = crestronData[0].data.rooms;


      for ( const device of crestronData[2].data.devices) {

        const roomName = this.rooms.find(r => r.id === device.roomId)?.name;
        const deviceType = device.subType || device.type;

        const d: Device = {
          id: device.id,
          type: device.type || device.subType,
          subType: deviceType,
          name: `${roomName} - ${device.name}`, // Name is "Room Name - Device Name"
          roomId: device.roomId,
          roomName: roomName || '',
        };

        this.enabledTypes.includes(deviceType) ?
          devices.push(d) : this.log.info('Device support is not enabled for:', deviceType);
      }

      for( const scene of crestronData[1].data.scenes){

        const roomName = this.rooms.find(r => r.id === scene.roomId)?.name;
        const d: Device = {
          id: scene.id,
          type: 'Scene',
          subType: scene.type,
          name: `${roomName} - ${scene.name}`, // Name is "Room Name - Service Name"
          roomId: scene.roomId,
          roomName: roomName || '',
        };

        this.enabledTypes.includes(scene.type) ?
          devices.push(d) : this.log.info('Scene support is not enabled for:', scene.type);
      }

      const d = devices.slice(0, 149);
      this.log.info('Returning 149 devices, the stuff left behind are', devices.slice(149, 1024) || 'None');

      this.log.debug('Get Devices response: ', devices);
      return d;
    } catch (error) {
      this.log.error('error getting devices: ', error);
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

  public async getShadeState(id: number){

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

  public async getScene(sceneId: number): Promise<Scene>{

    await this.login();
    try {
      const response = await this.axiosClient.get(`/scenes/${sceneId}`);
      return response.data.scenes[0];
    } catch (error){
      this.log.error('Unexpected error getting scene state: ', error);
      throw(error);
    }
  }

  public async recallScene(sceneId: number){

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

  public async login(): Promise<number> {

    // this.log.debug('Starting login...');

    if(new Date().getTime() - this.lastLogin < this.NINE_MINUTES_MILLIS ) {
      // this.log.debug('LOGIN: Session is still valid, doing nothing...');
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
}
