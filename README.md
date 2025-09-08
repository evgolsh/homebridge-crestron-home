
# Homebridge Crestron Home Plugin

This plugin connects to Crestron Home CWS server using REST API and doesn't require anything to be deployed into the Crestron controller. It was developed and tested with Crestron MC4-R powered by Crestron Home OS, but theoretically it should work with any Crestron controller that runs CWS server.

## Supported accessories
The following devices are currently supported:

### Core Lighting & Automation
* **Lights and Dimmers** - Full brightness control with on/off functionality
* **Shades** - Position control with real-time status updates
* **Scenes** - Lighting and shade scenes exposed as switches, genericIO scenes as locks

### Climate Control  
* **🌡️ Thermostats** - Complete HVAC control including:
  - Temperature monitoring and setpoint adjustment
  - Heating/Cooling mode control (OFF, HEAT, COOL, AUTO)
  - Fan mode control (AUTO, ON)
  - Automatic temperature unit conversion (Celsius ↔ Fahrenheit)
  - Real-time status updates

### Security & Access Control
* **🔐 Door Locks** - Secure access control featuring:
  - Remote lock/unlock control via HomeKit and Siri
  - Real-time lock status (locked/unlocked/jammed/unknown)
  - Connection status monitoring
  - Secure API communication

* **🛡️ Security Systems** - Home security integration including:
  - System arming/disarming (Disarmed, ArmStay, ArmAway, ArmInstant)
  - Real-time security status monitoring
  - Multiple security mode support

## Configuration
Two values are required for connecting Homebridge to Crestron controller:
1. Controller IP address (or hostname if DNS is configured)
2. Web API Authentication Token.
   Authentication Token can be found in the Crestron Home setup app. Go to settings and click on "System control options" in this screen:
   ![alt text](img/installer-setting.jpg)
   and then copy value of the Authentication token in this screen:
   ![alt text](img/api-token.jpg)
3. Enable accessories that will appear in HomeKit:
   ![alt text](img/config.jpg)
   
   Available device types:
   - `"Switch"` - Light switches
   - `"Dimmer"` - Dimmable lights  
   - `"Shade"` - Window shades/blinds
   - `"Scene"` - Lighting and automation scenes
   - `"Thermostat"` - HVAC thermostats ⭐ **NEW**
   - `"DoorLock"` - Door locks ⭐ **NEW** 
   - `"SecuritySystem"` - Security systems ⭐ **NEW**
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
                "Dimmer",
                "Thermostat"
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
                "Scene",
                "DoorLock",
                "SecuritySystem"
            ],
            "updateInterval": 30,
            "_bridge": {
                "username": "007:12:4D:38:0C:10",
                "port": 51812
            },
            "platform": "CrestronHomePlatform"
        },
   ```

## Device-Specific Features

### 🌡️ Thermostats
- **Temperature Control**: Set heating/cooling setpoints with precise temperature control
- **Mode Selection**: Choose between OFF, HEAT, COOL, and AUTO modes
- **Fan Control**: Adjust fan settings (AUTO/ON) 
- **Real-time Monitoring**: Live temperature readings and status updates
- **Unit Conversion**: Automatic conversion between Crestron's DeciFahrenheit and HomeKit's Celsius
- **HomeKit Integration**: Full Siri support ("Set living room temperature to 72 degrees")

### 🔐 Door Locks  
- **Remote Control**: Lock/unlock doors from anywhere via HomeKit
- **Status Monitoring**: Real-time lock status (locked/unlocked/jammed/unknown)
- **Siri Integration**: Voice control ("Lock the front door", "Is the garage door locked?")
- **Connection Alerts**: Notifications when locks go offline
- **Secure API**: Uses official Crestron Door Locks API endpoints

### 🛡️ Security Systems
- **System Control**: Arm/disarm security system remotely
- **Multiple Modes**: Support for Disarmed, ArmStay, ArmAway, and ArmInstant modes
- **Status Monitoring**: Real-time security system status
- **HomeKit Integration**: Control via Home app and Siri commands

## Troubleshooting

### New Device Types Not Appearing
1. Ensure the device type is added to your `enabledTypes` configuration
2. Restart Homebridge after configuration changes
3. Check Homebridge logs for device discovery information
4. Verify your Crestron system has the devices configured and online

### API Authentication Issues  
- Update your Web API Authentication Token after Crestron firmware upgrades
- **Note**: The plugin gracefully handles missing API endpoints - if your Crestron system doesn't support certain device types (thermostats, door locks, or security systems), simply don't include them in your `enabledTypes` configuration

### Performance with Many Devices
- For systems with 149+ total devices, use Child Bridge mode as shown in the configuration examples
- Consider splitting device types across multiple bridge instances for optimal performance


