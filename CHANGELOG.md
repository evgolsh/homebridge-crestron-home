# Change Log

## 1.1.4 (2022-07-04)
Removed Hyphen from device names. Device names are "Room Name Device Name". If rooms in Homekit match room names in Crestron, Homekit substitutes room name automatically
## v1.1.3 (2022-07-02)

### Breaking Changes

* Changed Lighting Scene to be a Switch in the Homekit (was exposed as a Lightbulb before). Please delete the Homebridge accessory cache after upgrading the plugin.