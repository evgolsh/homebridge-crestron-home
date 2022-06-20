
# Homebridge Crestron Home Plugin

This plugin works with REST API served by Crestron Home CWS server and doesn't require anything to be deployed into Crestron controllere. It was developed and tested with Crestron MC4-R powered by Crestron Home OS, but theoretically it should work with any Crestron controller that exposes Web REST APIs.

## Supported accessories
The following devices are currently supported:
* Lights and Dimmers
* Shades
* Lighting and Shades scenes (exposed as Switch in the HomeKit)

## Configuration
Two values are required for connecting Homebridge to Crestron controller:
1. Controller IP address (or hostname if DNS is configured)
2. Web API Authentication Token
   Authentication Token can be found in the Crestron Home setup app. Go to settings and click on "System control options" in this screen:
   ![alt text](img/installer-setting.jpg)
   and then copy value of the Authentication token in this screen:
   ![alt text](img/api-token.jpg)
3. Enable accessories that will appear in the HomeKit:
   ![alt text](img/config.jpg)
   

