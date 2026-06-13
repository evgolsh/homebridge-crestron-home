# Change Log

## 1.2.1 (2026-06-13)

* Fix `config.schema.json`: `required` is now an array at the object level instead
  of `required: true/false` on individual fields (valid JSON Schema).
* Add `homepage` to `package.json` and expand `keywords`.

(Changes for the Homebridge plugin verification checks.)

## 1.2.0 (2026-06-13)

### Homebridge 2.0 Support
* **Verified for Homebridge 2.0** - The plugin now compiles and passes its full test
  suite against Homebridge 2.x (tested on 2.1.0). No deprecated or removed HAP-NodeJS
  v1 APIs are used.
* **Engine requirements updated** - `engines.homebridge` is now `^1.8.0 || ^2.0.0`
  (existing Homebridge 1.x installs keep working); `engines.node` is now
  `^20.19.0 || ^22.12.0 || ^24.0.0`. Node 18 is end-of-life and unsupported by
  Homebridge 2's runtime.

### Dependency Modernization
* **Security** - Upgraded `axios` from 0.27 to 1.x, resolving 4 high-severity
  advisories. `npm audit` is now clean (0 vulnerabilities).
* **Tooling** - Upgraded to Jest 30, TypeScript 5.9, `@types/node` 25, `rimraf` 6,
  `nodemon` 3, `jest-mock-extended` 4, and added `axios-mock-adapter` as an explicit
  dev dependency. Removed the unused `jest-mock-axios` and the redundant
  `@types/axios-mock-adapter` (the package now ships its own types).
  *(TypeScript is held at the latest 5.x because ts-jest does not yet support
  TypeScript 6.)*
* **Linting** - Migrated to ESLint 10 with the modern flat config
  (`eslint.config.mjs`), `typescript-eslint` 8, and `@stylistic/eslint-plugin` for
  formatting rules.
* **Build** - Added `skipLibCheck` to `tsconfig.json` so transitive type definitions
  bundled by Homebridge 2 do not break compilation.

### Fixes & Housekeeping
* Replaced the deprecated `NodeJS.Timer` type with `NodeJS.Timeout` in the shade
  accessory.
* Rewrote a side-effecting ternary in the scene accessory as a plain assignment.
* Added a `files` allowlist to `package.json` so the published package contains only
  `dist/`, `config.schema.json`, `img/`, and docs — dev artifacts and tests are no
  longer published.

## 1.1.10 (2025-01-08)

* **Node.js Requirement Updated** - Minimum Node.js version is now 18.0.0 (previously 14.18.1)
  
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