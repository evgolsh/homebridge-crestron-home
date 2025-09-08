# Change Log

## 1.1.10 (2024-12-19)

### Major New Features
* **🌡️ Thermostat Support** - Full HVAC control with temperature adjustment, heating/cooling modes (OFF/HEAT/COOL/AUTO), and fan control
  - Automatic temperature conversion between Crestron's DeciFahrenheit and HomeKit's Celsius
  - Real-time temperature monitoring and setpoint control
  - Support for both heating and cooling setpoints
  - Fan mode control (AUTO/ON)
  
* **🔐 Door Lock Support** - Complete door lock integration with secure lock/unlock control
  - Real-time lock status monitoring (locked/unlocked/jammed/unknown)
  - Remote lock/unlock via HomeKit and Siri
  - Connection status monitoring (online/offline)
  - Secure API implementation following Crestron Door Locks API specification
  
* **🛡️ Security System Support** - Home security system integration
  - Security system state control (Disarmed/ArmStay/ArmAway/ArmInstant)
  - Real-time security status monitoring
  - Support for multiple security states and modes

### Technical Improvements
* **Enhanced API Implementation** - Updated to use official Crestron API endpoints:
  - `/thermostats/SetPoint` for temperature control
  - `/thermostats/mode` for heating/cooling mode changes
  - `/thermostats/fanmode` for fan control
  - `/doorlocks/lock/{id}` and `/doorlocks/unlock/{id}` for door control
  - `/securitydevices/{id}` for security system control
  
* **Improved Device Discovery** - Enhanced device detection and matching between `/devices` and specialized endpoints
* **Better Error Handling** - Comprehensive error handling and logging for all new device types
* **Type Safety** - Full TypeScript implementation with proper interfaces and type checking
* **Unit Testing** - Complete test coverage for all new functionality

### Configuration Updates
* Added new device types to configuration schema:
  - `"Thermostat"` - Enable thermostat devices
  - `"DoorLock"` - Enable door lock devices  
  - `"SecuritySystem"` - Enable security system devices

### Configuration Changes
* **New Device Types** - Additional device types available in `enabledTypes` configuration:
  - `"Thermostat"` - Enable thermostat devices
  - `"DoorLock"` - Enable door lock devices
  - `"SecuritySystem"` - Enable security system devices
* **Backward Compatibility** - Existing configurations continue to work unchanged
* **Graceful Degradation** - Plugin gracefully handles missing API endpoints - simply configure the device types your system supports

## 1.1.8 (2023-12-26)
Fixed 149 devices warning

## 1.1.7 (2023-12-26)
Stability fix by @mcm246

## 1.1.4 (2022-07-04)
Removed Hyphen from device names. Device names are "Room Name Device Name". If rooms in Homekit match room names in Crestron, Homekit substitutes room name automatically
## v1.1.3 (2022-07-02)

### Breaking Changes

* Changed Lighting Scene to be a Switch in the Homekit (was exposed as a Lightbulb before). Please delete the Homebridge accessory cache after upgrading the plugin.