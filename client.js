const BeaconScanner = require('./node-beacon-scanner/lib/scanner.js');
const noble = require('@abandonware/noble');
const http = require('https');
const options = require("./config/client_config.js");
const utils = require("./utils.js");
const generateEid = require("./ephemeralId").generateEid;

const scanner = new BeaconScanner({noble: noble});
const COMMANDS_PRESENT = "arrived";
const COMMANDS_DEPARTED = "departed";
const defaults = {
  "count": 0,
  "present": null
};

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

let tmp = [];

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
  if(ad.beaconType !== 'eddystoneEid'){
    return;
  }
  
  //const distance = Math.pow(10,( (ad.iBeacon.txPower - ad.rssi) / (10 * 2)));
  names.forEach((name) => {
    const localEid = generateEid(
      registeredBeacons[name].identityKey,
      registeredBeacons[name].rotationPeriod
    );

    if(ad.eddystoneEid.eid === localEid){
      if(!registeredBeacons[name].present){
        updatePresence(name, true).then(() => {
          registeredBeacons[name].present = true;
        }).catch(() => utils.log("updatePresence call was rejected"));
      }
      registeredBeacons[name].count = 0;
    }
  })
};

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
  /**
   * Sometimes, on reboot bluetooth interface cannot start. 
   * @TODO send notification about bluetooth interface not starting
   */
  let blActive = false;
  setTimeout(() => {
    if(!blActive){
      stopScan();
      utils.log("BL scan could not start. Rebooting");
      require('child_process').exec('sudo /sbin/shutdown -r now', function (msg) { utils.log(msg) });
    }
  }, 1500)
  return new Promise((resolve, reject) => {
    // Start scanning
    scanner.startScan().then(() => {
      utils.log('Started to scan.');
      intervalManager.startInterval();
      blActive = true;
      resolve();
    }).catch((error) => {
      utils.error(new Date(), error);
      reject();
    });
  });
};

const registerBeacons = (subjects) => {
  registeredBeacons = Object.keys(subjects).reduce((acc, subject) => {
    names.push(subject);
    acc[subject] = {
      subject,
      ...subjects[subject].eidSettings,
      ...defaults
    };
    return acc;
  },{})
}

const stopScan = () => {
  return new Promise((resolve, reject) => {
    // Stop scanning
    scanner.stopScan();
    intervalManager.stopInterval();
    utils.log('Scan stopped.');
    resolve();
  });
}

const intervalManager = {
  interval: null,
  startInterval: function(){
    utils.log("Start interval");
    this.interval = setInterval(() => {
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

  },
  stopInterval: function(){
    utils.log("Clear interval");
    clearInterval(this.interval);
  }
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

