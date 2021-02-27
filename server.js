const https = require("https");
const http = require("http");
const fs = require("fs");
const dns = require("dns");
const subjectsConfig = require("./config/subjects.js");
const config = require("./config/server_config.js");
const utils = require("./utils.js");

const providers = {};
const LOG_SIZE = 30;
const COMMANDS_PRESENT = "arrived";
const COMMANDS_DEPARTED = "departed";

const subjects = Object.keys(subjectsConfig.subjects).reduce((acc, name) => {
  acc[name] = {
    ...subjectsConfig.subjects[name],
    present: null
  }
  return acc;
}, {});

const srvOptions = {
  key: fs.readFileSync("./certs/keyFile.key"),
  cert: fs.readFileSync("./certs/crtFile.crt")
}

const srv = https.createServer(srvOptions, (req, res) => {
    res.setHeader("Content-Type", "application/json");
});

function callDevice(subject, newState){
  const path = `${config.path}/${subjects[subject].deviceId}/${newState ? COMMANDS_PRESENT : COMMANDS_DEPARTED}?access_token=${config.ACCESS_TOKEN}`;
  http.get(`${config.host}${path}`, (res) => {
    utils.log(path.split("?")[0], ` - ${res.statusCode}`);
  });
}

function updatePresence(data){
  if(subjects[data.subject].present !== data.newState || data.newState === null){
    const newState = Object.keys(providers).reduce((acc, ip) => {
      return acc || providers[ip].isPresent(data.subject);
    }, false);
    if(newState !== subjects[data.subject].present){
      subjects[data.subject].present = newState;
      utils.log(`Update presence for ${data.subject} to ${newState}`);
      callDevice(data.subject, newState);
    }
  }
}


const handler = {
  register(req, res){
    const ip = req.connection.remoteAddress; 
    return new Promise((resolve, reject) => {
      const userpass = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString();
      if (userpass !== config.credentials.join(":")) {
        utils.log("invalid registration");
        reject(401);
        return;
      }

      if(providers[ip]){
        providers[ip].removeEventListeners();
      }
      providers[ip] = new PresenceProvider();
      providers[ip].addEventListener(PresenceProvider.EVT_UPDATE_PRESENCE, updatePresence);

      utils.log(`Registered ${ip} as presence provider`);
      res.setHeader("Content-Type", "application/json");
      res.write(JSON.stringify(subjectsConfig));
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
      providers[ip].setPresence(query.subject, query.present).then((updated) => {
        resolve(updated ? 200 : 202);
      });
    });
  },
  status(res){
    const result = Object.keys(subjects).reduce((acc, name) => {
      acc[name] = {
        present: subjects[name].present,
        lastSeen: Object.keys(providers).reduce((acc, ip) => {
          const lastSeen = providers[ip].lastSeen(name) ? new Date(providers[ip].lastSeen(name)) : null;
          if(acc === null){
            if(lastSeen === null){
              return null;
            }
            return {
              time: lastSeen,
              provider: ip
            }
          }
          return acc < lastSeen ? {time: lastSeen, provider: ip} : acc;
        }, null)
      }
      return acc;
    }, {});
    res.setHeader("Content-Type", "application/json");
    res.write(JSON.stringify(result));
    return Promise.resolve(200);
  }
}


class PresenceProvider {
  constructor(){
    this.log = [];
    this.listeners = {};
    this.currentState = {};
  }

  setPresence(subject, newPresence){
    const oldState = !!this.currentState[subject];
    if(newPresence !== "null"){
      this.log.push({
        time: new Date(),
        value: newPresence,
        subject: subject,
      });
      this.logRotate();
    }
    this.currentState[subject] = newPresence === "null" ? null : newPresence === "true";
    if(oldState !== this.currentState[subject]){
      this.dispatchEvent(this.constructor.EVT_UPDATE_PRESENCE, {
        provider: this,
        subject: subject,
        oldState: oldState,
        newState: this.currentState[subject]
      });
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  isPresent(subject){
    return !!this.currentState[subject];
  }

  lastSeen(subject){
    const tmp = [...this.log.reverse()];
    const len = tmp.length;
    for(let i = 0; i < len; i++){
      if(tmp[i].subject === subject){
        return tmp[i].time;
      }
    }
    return null;
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

/* device sync failover: sync everything every 5 minute
setInterval(() => {
  if(Object.keys(providers).length < 1){
    utils.log("Cancel device sync: no provders registered.")
    return;
  }
  Object.keys(subjects).forEach((subject) => {
    if(subjects[subject].present !== null){
      utils.log(`sync device for ${subject}: ${subjects[subject].present}`)
      callDevice(subject, subjects[subject].present);
    }
  });
}, 300000)
*/


srv.addListener("request", (req, res) => {
  const path = req.url.split("?");
  let prm = null;
  switch(path[0]){
    case "/register":
      prm = handler.register(req, res);
      break;
    case "/update":
      prm = handler.update(req);
      break;
    case "/status":
      prm = handler.status(res);
      break;
    default:
      prm = Promise.reject(404);
  }
  prm.then((code)=>{
    if(!res.headersSent){
      res.writeHead(code ? code : 200);
    }
    res.end();
  }).catch((code) => {
    utils.log(code);
    res.writeHead(typeof code === "number" ? code : 500);
    res.end();
  });
})

srv.listen(3300, () => {
    utils.log("Listening on 3300.")
})

