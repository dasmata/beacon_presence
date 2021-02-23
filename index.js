const BeaconScanner = require('node-beacon-scanner');
const noble = require('@abandonware/noble');
const http = require('http');

const scanner = new BeaconScanner({noble: noble});
const COMMANDS_PRESENT = "arrived";
const COMMANDS_DEPARTED = "departed";
const PRESENCE_COUNT = 120;
const defaults = {
  "count": PRESENCE_COUNT,
  "present": false,
};
const options = {
  "host": "http://piemade.home:3300",
  "path": "/update"
}


let registeredBeacons = {};
let names = [];
function updatePresence(name, present){
  const path = `${options.path}?present=${present}&subject=${name}`;
  return new Promise((resolve, reject) => {
    http.get(`${options.host}${path}`, (res) => {
      if(res.statusCode === 401){
        restart();
        reject();
        return;
      }
      if(res.statusCode === 202){
        console.log("state not updated");
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
    if(registeredBeacons[name].uuid === ad.iBeacon.uuid){
      if(!registeredBeacons[name].presence){
        updatePresence(name, true).then(() => {
          registeredBeacons[name].presence = true;
        }).catch(() => console.log("updatePresence call was rejected"));
      }
      registeredBeacons[name].count = 0;
    }
  })
};


setInterval(() => {
  names.forEach((name) => {
    if(registeredBeacons[name].count < PRESENCE_COUNT){
      registeredBeacons[name].count++;
    } else if(registeredBeacons[name].presence){
      updatePresence(name, false);
      registeredBeacons[name].presence = false;
    }
  });
}, 1000);

const register = () => {
  return new Promise((resolve, reject) => {
    console.log("registering to agregator");

    http.get(`${options.host}/register`, (res) => {
      if(res.statusCode === 200){
        let data = '';
        res.on("data", (chunk) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          console.log("registered!");
          resolve(JSON.parse(data));
        });
        return;
      }
      console.log("failed! retry in 1s");
      setTimeout(() => resolve(register()), 1000);
    }).on("error", (e) => {
      console.log("failed! retry in 1s");
      setTimeout(() => resolve(register()), 1000);
    });
  })
};

const startScan = () => {
  return new Promise((resolve, reject) => {
    // Start scanning
    scanner.startScan().then(() => {
      console.log('Started to scan.');
      resolve();
    }).catch((error) => {
      console.error(error);
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
    console.log('Scan stopped.');
    resolve();
  });
}

const init = () => {
  return register().then((subjects) => {
    registerBeacons(subjects);
    return startScan();
  });
};

const restart = () => {
  console.log("Restarting...")
  return stopScan().then(() => init());
}

init();

