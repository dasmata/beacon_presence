const http = require("http");
const dns = require("dns");
const subjectsConfig = require("./subjects.js");
const config = require("./config.js");

const providers = {};
const LOG_SIZE = 30;
const COMMANDS_PRESENT = "arrived";
const COMMANDS_DEPARTED = "departed";

const subjects = Object.keys(subjectsConfig).reduce((acc, name) => {
  acc[name] = {
    ...subjectsConfig[name],
    present: false
  }
  return acc;
}, {});

const srv = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
});

function updatePresence(data){
  if(subjects[data.subject].present !== data.newState){
    const path = `${config.path}/${subjects[data.subject].deviceId}/${data.newState ? COMMANDS_PRESENT : COMMANDS_DEPARTED}?access_token=${config.ACCESS_TOKEN}`;
    subjects[data.subject].present = data.newState;
    console.log(`Update presence for ${data.subject} to ${data.newState}`);
    http.get(`${config.host}${path}`);
  }
}


const handler = {
  register(req){
    const ip = req.connection.remoteAddress;
    return new Promise((resolve, fail) => {
      if(providers[ip]){
        providers[ip].removeEventListeners();
      }
      providers[ip] = new PresenceProvider();
      providers[ip].addEventListener(PresenceProvider.EVT_UPDATE_PRESENCE, updatePresence);
      console.log(`Registered ${ip} as presence provider`);
      resolve();
    });
  },
  update(req){
    const path = req.url.split("?");
    const ip = req.connection.remoteAddress;
    const query = path[1] ? path[1].split("&").reduce((acc, value) => {
      const parsed = value.split("=");
      acc[parsed[0]] = parsed.slice(1).join("=");
      return acc;
    }, {}) : null;
    return new Promise((resolve, reject) => {
      if(!providers[ip]){
        reject(401);
        return;
      }
      if(!query){
        reject(400);
      }
      providers[ip].setPresence(query.subject, query.present);
      resolve();
    });
  }
}


class PresenceProvider {
  constructor(){
    this.log = [];
    this.listeners = {};
    this.currentState = {};
  }

  setPresence(subject, newPresence){
    const oldState = this.currentState[subject] || false;
    this.log.push({
      time: new Date(),
      value: newPresence,
      subject: subject,
    });
    this.currentState[subject] = newPresence === "true";
    this.logRotate();
    this.dispatchEvent(this.constructor.EVT_UPDATE_PRESENCE, {
      provider: this,
      subject: subject,
      oldState: oldState,
      newState: this.currentState[subject]
    })
  }

  isPresent(subject){
    return false;
  }

  logRotate(){
    const len = this.log.length;
    if(len > LOG_SIZE){
      this.log = this.log.slice(len - LOG_SIZE);
    }
  }

  addEventListener(evtName, callback){
    this.listeners[evtName] = this.listeners[evtName] || new Set();
    this.listeners[evtName].add(callback);
  }

  removeEventListener(evtName, callback){
    this.listeners[evtName] && this.listeners[evtName].has(callback) ? this.listeners[evtName].delete(callback) : false;
  }

  removeEventListeners(){
    this.listeners = {};
  }

  dispatchEvent(evtName, data){
    this.listeners[evtName] && this.listeners[evtName].forEach(( clbk ) => {
      clbk(data)
    })
  }
}

PresenceProvider.EVT_UPDATE_PRESENCE = "@@presenceProvider/update";




srv.addListener("request", (req, res) => {
  const path = req.url.split("?");
  let prm = null;
  switch(path[0]){
    case "/register":
      prm = handler.register(req);
      break;
    case "/update":
      prm = handler.update(req);
      break;
    default:
      prm = Promise.reject(404);
  }
  prm.then(()=>{
    res.writeHead(200);
    res.end();
  }).catch((code) => {
    console.log(code);
    res.writeHead(typeof code === "number" ? code : 500);
    res.end();
  });
})

srv.listen(3300, () => {
    console.log("Listening on 3300.")
})

