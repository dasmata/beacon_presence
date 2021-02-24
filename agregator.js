const https = require("https");
const http = require("http");
const fs = require("fs");
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

const srvOptions = {
  key: fs.readFileSync("./certs/piemade.home.key"),
  cert: fs.readFileSync("./certs/piemade.home.crt")
}

const srv = https.createServer(srvOptions, (req, res) => {
    res.setHeader("Content-Type", "application/json");
});

function updatePresence(data){
  if(subjects[data.subject].present !== data.newState){
    const newState = Object.keys(providers).reduce((acc, ip) => {
      return acc || providers[ip].isPresent(data.subject);
    }, false);
    if(newState !== subjects[data.subject].present){
      const path = `${config.path}/${subjects[data.subject].deviceId}/${newState ? COMMANDS_PRESENT : COMMANDS_DEPARTED}?access_token=${config.ACCESS_TOKEN}`;
      subjects[data.subject].present = newState;
      console.log(`Update presence for ${data.subject} to ${newState}`);
      http.get(`${config.host}${path}`);
    }
  }
}


const handler = {
  register(req, res){
    const ip = req.connection.remoteAddress; 
    return new Promise((resolve, reject) => {
      const userpass = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString();
      if (userpass !== config.credentials.join(":")) {
        console.log("invalid registration");
        reject(401);
        return;
      }

      if(providers[ip]){
        providers[ip].removeEventListeners();
      }
      providers[ip] = new PresenceProvider();
      providers[ip].addEventListener(PresenceProvider.EVT_UPDATE_PRESENCE, updatePresence);

      console.log(`Registered ${ip} as presence provider`);
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
          const lastSeen = providers[ip].lastSeen(name);
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
    this.log.push({
      time: new Date(),
      value: newPresence,
      subject: subject,
    });
    this.currentState[subject] = newPresence === "true";
    this.logRotate();
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
    console.log(code);
    res.writeHead(typeof code === "number" ? code : 500);
    res.end();
  });
})

srv.listen(3300, () => {
    console.log("Listening on 3300.")
})

