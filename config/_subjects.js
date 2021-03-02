const subjects = {
  "subject1": { // subject's name
    "eidSettings": {
      "identityKey": "00112233445566778899aabbcc", // identity key used by the eddystone-eid beacon
      "rotationPeriod": 32 // time (in seconds) for the eid rotation
    },
    "deviceId": 1 // HE Virtual Presence device id
  }
}

const PRESENCE_COUNT = 120; // Number of seconds after which the subject is considered departed

module.exports = {
  subjects,
  PRESENCE_COUNT  
}

