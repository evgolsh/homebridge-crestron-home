
# Homebridge Crestron Home Plugin

This plugin connects to Crestron Home CWS server using REST API and doesn't require anything to be deployed into the Crestron controller. It was developed and tested with Crestron MC4-R powered by Crestron Home OS, but theoretically it should work with any Crestron controller that runs CWS server.

## Supported accessories
The following devices are currently supported:
* Lights and Dimmers
* Shades
* Lighting scenes exposed as LightBulb in the HomeKit
* Shade scenes exposed as Switch 
* genericIO scenes exposed as Locks

## Configuration
Two values are required for connecting Homebridge to Crestron controller:
1. Controller IP address (or hostname if DNS is configured)
2. Web API Authentication Token.
   Authentication Token can be found in the Crestron Home setup app. Go to settings and click on "System control options" in this screen:
   ![alt text](img/installer-setting.jpg)
   and then copy value of the Authentication token in this screen:
   ![alt text](img/api-token.jpg)
3. Enable accessories that will appear in the HomeKit:
   ![alt text](img/config.jpg)
4. updateInterval: (Optional) Set refresh status interval in seconds (default 30). According to Crestron documentation, login session is valid for 10 minutes. We keep session TTL 9 minutes, relogin and refresh devices status with the given interval.

## Notes
* Delete Homebridge accessories cache after each plugin update
* After every upgrade of the Crestron firmware, you need to update the Web API Authentication Token in the Crestron Home Setup app (or XPanel), copy the value, update configuration and restart the Crestron controller
* If you have more than 149 devices and scenes, this plugin will crash. In this case you need to run this plugin in the [Homebridge child bridge mode](https://github.com/homebridge/homebridge/wiki/Child-Bridges) and split devices accross different instances of the plugin. Example configuration:
  ```json
  {
            "name": "Crestron Home Platform",
            "crestronHost": "YOUR_CONTROLLER_IP",
            "token": "YOUR_AUTH_KEY",
            "enabledTypes": [
                "Switch",
                "Dimmer"
            ],
            "updateInterval": 30,
            "_bridge": {
                "username": "07:12:4D:38:0C:09",
                "port": 51811
            },
            "platform": "CrestronHomePlatform"
        },
        {
            "name": "Crestron Home Platform",
            "crestronHost": "YOUR_CONTROLLER_IP",
            "token": "YOUR_AUTH_KEY",
            "enabledTypes": [
                "Shade",
                "Scene"
            ],
            "updateInterval": 30,
            "_bridge": {
                "username": "007:12:4D:38:0C:10",
                "port": 51812
            },
            "platform": "CrestronHomePlatform"
        },
   ```
   

