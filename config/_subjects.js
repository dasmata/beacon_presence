const subjects = {
  "subject1": { // subject's name
    "uuid": ["beaconId1", "beaconId2"], // a list of this subject's beacon ids
    "deviceId": 1 // HE Virtual Presence device id
  }
}

const PRESENCE_COUNT = 120; // Number of seconds after which the subject is considered departed

module.exports = {
  subjects,
  PRESENCE_COUNT  
}

