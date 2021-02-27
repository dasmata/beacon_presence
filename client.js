const BeaconScanner = require('node-beacon-scanner');
const noble = require('@abandonware/noble');
const http = require('https');
const options = require("./config/client_config.js");
const utils = require("./utils.js");

const scanner = new BeaconScanner({noble: noble});
const COMMANDS_PRESENT = "arrived";
const COMMANDS_DEPARTED = "departed";
const defaults = {
  "count": Number.MAX_VALUE,
  "present": null
};

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

let registeredBeacons = {};
let names = [];
let PRESENCE_COUNT = 0;
function updatePresence(name, present){
  const path = `/update?present=${present}&subject=${name}`;
  utils.log(`updating state for ${name} to ${present}`);
  return new Promise((resolve, reject) => {
    http.get(`${options.host}${path}`, (res) => {
      if(res.statusCode === 401){
        restart();
        reject();
        return;
      }
      if(res.statusCode === 202){
        utils.log("state not updated");
        reject();
        return
      }
      resolve();
    });
  });
}

// Set an Event handler for becons
scanner.onadvertisement = (ad) => {
  //const distance = Math.pow(10,( (ad.iBeacon.txPower - ad.rssi) / (10 * 2)));
  names.forEach((name) => {
    if(registeredBeacons[name].uuid.indexOf(ad.iBeacon.uuid) !== -1){
      if(!registeredBeacons[name].present){
        updatePresence(name, true).then(() => {
          registeredBeacons[name].present = true;
        }).catch(() => utils.log("updatePresence call was rejected"));
      }
      registeredBeacons[name].count = 0;
    }
  })
};


setInterval(() => {
  names.forEach((name) => {
    if(registeredBeacons[name].count <= PRESENCE_COUNT){
      registeredBeacons[name].count++;
    } else if(registeredBeacons[name].present || registeredBeacons[name].present === null){
      updatePresence(name, registeredBeacons[name].present === null ? null : false)
        .catch(() => {});
      registeredBeacons[name].present = false;
    }
  });
}, 1000);

const register = () => {
  return new Promise((resolve, reject) => {
    utils.log("registering to agregator");

    http.get(`${options.host}/register`, {
      headers: {
        authorization: `bearer ${Buffer.from(options.credentials.join(":")).toString('base64')}`
      }
    }, (res) => {
      if(res.statusCode === 200){
        let data = '';
        res.on("data", (chunk) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          utils.log("registered!");
          resolve(JSON.parse(data));
        });
        return;
      }
      utils.log(res);
      utils.log("failed! retry in 1s");
      setTimeout(() => resolve(register()), 1000);
    }).on("error", (e) => {
      utils.log("failed! retry in 1s");
      utils.log(e);
      setTimeout(() => resolve(register()), 1000);
    });
  })
};

const startScan = () => {
  return new Promise((resolve, reject) => {
    // Start scanning
    scanner.startScan().then(() => {
      utils.log('Started to scan.');
      resolve();
    }).catch((error) => {
      console.error(new Date(), error);
      reject();
    });
  });
};

const registerBeacons = (subjects) => {
  registeredBeacons = Object.keys(subjects).reduce((acc, subject) => {
    acc[subject] = {
      ...subjects[subject],
      ...defaults
    };
    return acc;
  },{})
  names = Object.keys(registeredBeacons);
}

const stopScan = () => {
  return new Promise((resolve, reject) => {
    // Start scanning
    scanner.stopScan();
    utils.log('Scan stopped.');
    resolve();
  });
}

const init = () => {
  return register().then((subjectsConfig) => {
    registerBeacons(subjectsConfig.subjects);
    PRESENCE_COUNT = subjectsConfig.PRESENCE_COUNT;
    return startScan();
  });
};

const restart = () => {
  utils.log("Restarting...")
  return stopScan().then(() => init());
}

init();

