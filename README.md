# HUbitat BLE Beacon Senzor
Hubitat BLE Beacon senzor ie meant to be used as a BLE beacon receiver that updates a virtual presence device in Hubitat Elevantion if the beacon is present or departed.
It can track multiple subjects each with mutiple beacons assigned and can aggregate multiple BLE recevers to update one single HE presence device.
The application conssists of a server and a client.
*server* - acts as an agregator for all the client BLE rceivers. You only need one server for a whole network a clients. The server is the component that updates HE presence devices via Maker API si you ust register those devices in Maker API
*client* - Uses the bluetooth device to track the beacons. In order for it to do so, it needs sudo permissions. You can have multiple clients, all running on different machines, in order to get full coverage of your house. All the clients will be reporting back to the server so they must be able to communicate to the server app.
The server and one client can both run on the same machine.


## Requirements
* bluetooth enabled machine (tested on raspberry pi 3 and 4)
* NodeJs 10.23+

## Instalation
Run the following commands in project root. For the setup command, you will need sudo rights. Root password might be required

```bash
npm run setup

pm2 startup

cd ./config

mv _client_config.js client_config.js

mv _server_config.js server_config.js

mv _subjects.js subjects.js
```
Now you need to edit all the config files and add your data. PLease see the config documentation below.
For security reasons, the server runs on HTTPS so it needs a self-signed certificate. You cand get one by following these steps: https://flaviocopes.com/express-https-self-signed-certificate/ . Name your files crtFile.crt and keyFile.key and place them in the cert folder.

### Client Config
This file is used by the BLE recever in order to register with the server and also report the beacons states.
#### Credentials
The username and password required by the server to register clients. This represents only and example. Plaese provide your own values.
```json
{
  "credentials": ["ussername", "password"]
}
```
#### Host
The server's URL. The port is 3300. This represents only and example. Plaese provide your own values.

```json
{
  "host": "https://192.168.1.3:3300"
}
```
### Server Config
This file is used by the server in order to communicate with HE and validate the receivers credentials. 
#### Host
represents teh URL for the HE. This represents only and example. Plaese provide your own values.

```json
{
  "host": "http://192.168.1.2"
}
```
#### path
Represents the path exposed by the Maker API App. This represents only and example. Plaese provide your own values.

```json
{
  "path": "/apps/api/12/devices"
}
```
#### ACCESS_TOKEN
Represents the acces tken provided by the Maker API app. When you regenerate the token in the Makes API, you must also updated it in this config. This represents only and example. Plaese provide your own values.
```json
{
  "ACCESS_TOKEN": "e79db7ad-d3e0-4f97-b672-b6423e57A295"
}
```
#### credentials
Credentials usd to authenticate BLE clients. They must match the credentials in the client_config file.  This represents only and example. Plaese provide your own values.
```json
{
  "credentials": ["ussername", "password"]
}
```

## Usage
### server
In order to start the server you will need to run the following command
```bash
npm run start_server
```
This will register a process in PM2. In order for the server to run at startup you need to run
```bash
pm2 save
```

### client
In order to start the server you will need to run the following command.
```bash
npm run start_client
```
This will register a process in PM2 as root. Root prvileges are neede in order to use the bluetoth device. In order for the server to run at startup you need to run
```bash
sudo pm2 save
```

