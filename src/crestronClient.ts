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

export interface CrestronDevice{
  id: number;
  name: string;
  type: string;
  subType: string;
  roomId: number;
  roomName: string;
  status: boolean;
  level: number;
  position: number;
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
    public readonly log: Logger ) {

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
      ]);

      this.rooms = crestronData[0].data.rooms;


      for ( const device of crestronData[2].data.devices) {

        const roomName = this.rooms.find(r => r.id === device.roomId)?.name;
        const deviceType = device.subType || device.type;
        let shadePosition = 0;
        if(deviceType === 'Shade'){
          shadePosition = crestronData[3].data.shades.find(sh => sh.id === device.id)?.position;
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
        };

        if (enabledTypes.includes(deviceType)){
          devices.push(d);
        }

      }

      for( const scene of crestronData[1].data.scenes){

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

        if (enabledTypes.includes('Scene')){
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

    this.log.debug('Starting login...');

    if(new Date().getTime() - this.lastLogin < this.NINE_MINUTES_MILLIS ) {
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
}
