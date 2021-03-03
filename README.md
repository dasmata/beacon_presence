[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/dasmata/beacon_presence/graphs/commit-activity)

# Hubitat Eddystone-EID Beacon Sensor
Hubitat Eddystone-EID Beacon sensor is meant to be used as a Eddystone-EID beacon receiver that updates a virtual presence device in Hubitat Elevantion if the beacon is present or departed.
It can track multiple subjects and can aggregate multiple receivers to update one single HE presence device.
The application consists of a server and a client.
* *server* - acts as an agregator for all the client Eddystone-EID receivers. You only need one server for a whole network of clients. The server is the component that updates HE presence devices via Maker API. NOTE: you must register those devices in Maker API
* *client* - Uses the bluetooth device to track the beacons. In order for it to do so, it needs sudo permissions. You can have multiple clients, all running on different machines, in order to get full coverage of your house. All the clients will be reporting back to the server so they must be able to communicate to the server app.
The server and one client can both run on the same machine.


## Requirements
* bluetooth enabled machine (tested on raspberry pi 3 and 4)
* NodeJs 10.23+

## Installation
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
This file is used by the recever in order to register with the server and also report the beacons states.
#### Credentials
The username and password required by the server to register clients. This represents only an example. Please provide your own values.
```json
{
  "credentials": ["username", "password"]
}
```
#### Host
The server's URL. The port is 3300. This represents only an example. Please provide your own values.

```json
{
  "host": "https://192.168.1.3:3300"
}
```
### Server Config
This file is used by the server in order to communicate with HE and validate the clients credentials. 
#### Host
represents the URL for the HE. This is only an example. Please provide your own values.

```json
{
  "host": "http://192.168.1.2"
}
```
#### path
Represents the path exposed by the Maker API App. This is only an example. Please provide your own values.

```json
{
  "path": "/apps/api/12/devices"
}
```
#### ACCESS_TOKEN
Represents the acces token provided by the Maker API app. When you regenerate the token in the Makes API, you must also updated it in this config. This represents only an example. Please provide your own values.
```json
{
  "ACCESS_TOKEN": "e79db7ad-d3e0-4f97-b672-b6423e57A295"
}
```
#### credentials
Credentials used to authenticate BLE clients. They must match the credentials in the client_config file.  This represents only and example. Please provide your own values.
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
In order to start the client you will need to run the following command.
```bash
npm run start_client
```
This will register a process in PM2 as root. Root prvileges are needed in order to use the bluetoth device. In order for the server to run at startup you need to run
```bash
sudo pm2 save
```
## Server API
### GET /register
Used to register a new client. Responds with a 200 HTTP status code on success or a 401 HTTP status code on auth failure. The body of the response will contain the list of subjects and a time interval (in seconds) that must pass before a subject is considered departed.
### GET /update
Updates the state of a subject.
#### params
* subject [string] - the sujects whos status is updated
* present [boolean | null] - the subjects status as follows:
    ** `true` if the subject is present
    ** `false` if the subject is departed
    ** `null` if the subject was not seen at all from the start of the client. This translates in a "departed" status but the system traks it differently
This method returns an empty body with the following HTTP status codes:
* 400 for invalid parameters
* 401 for an unregistered client provider
* 200 on status update
* 202 if the reuqest is valid but the subject's status allready is eaquat to the updated status
### GET /status
This url retus the current stats and the last seen date for all subjects. It requires a basic HTTP authentication with the same credentials that are used by de client providers.
Returns the data formatted as json o success or a 401 http status code (with empty body) in case of auth failure.
*Response Example*
```json
{
  "subjectName": {
    "present":true,
    "lastSeen": {
      "time":"2021-02-27T20:04:59.637Z",
      "provider":"::ffff:192.168.1.3"
    }
  }
}
```
## Security concerns
BLE Beacon technologies are generally known to be a security hazard because there is no encryption and the broadcaseted message is public. Eddystone-EID broadcasts an encrypted rotating identifier in order to increase the security of the protocol, but otherwise acts similarly to the UID frame. That means that messages transmitted by and Eddystone-EID beacon change over time and are encrypted using an algorithm based on a shared secred (AES-128-ECB) thus making this type of beacon suitable for use cases where security is a major concern: unlocking door locks, arming/disarming security monitors... etc.

Besides message encryption, Eddystone-EID protocol ensures the identity of both beacons and receiver via a registration service. Right now, Hubitat Eddystone-EID Beacon Sensor **DOES NOT** implement the part of the protocol that ensures the identity and I have no intent of implementing it because I don't see it as a major risk. If you have the time to do so, please create a pull request.

---
**Special thanks** to Futomi Hatano (https://github.com/futomi) for his node-beacon-scanner package that I had to include in the project sources because my Eddystone-EID beacon simmulator sends out frames of 14 bits instead of 10 so I had to remove a validation from his code.

