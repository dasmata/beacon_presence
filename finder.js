const BeaconScanner = require('node-beacon-scanner');
const noble = require('@abandonware/noble');
const utils = require("./utils.js");

const scanner = new BeaconScanner({noble: noble});

const found = {};

// Set an Event handler for becons
scanner.onadvertisement = (ad) => {
  if(ad.beaconType === 'eddystoneEid'){
    utils.log(ad);
  }
};

scanner.startScan().then(() => {
  utils.log('Started to scan.');
}).catch((error) => {
  utils.error(new Date(), error);
});

