let cmd, voz, permitBadge, userPermit, banWords = [], isPlaying = false, inT, outT, volumen, pre;
let textoPendiente = [], showPendiente = [];
let customRewards = {};
const TTS_BASE = "https://api.streamelements.com/kappa/v2/speech"; // Stream Elements Speech API
const TTS_BASEG = "http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&client=tw-ob&prev=input&textlen"; // Google Translate TTS	
const elements = {
	source: document.querySelector("#source"),
	audio: document.querySelector("#audio"),
  sourceG: document.querySelector("#sourceG"),
	audioG: document.querySelector("#audioG"),
};
let service = 'Polly';
let msgQueue = [];

window.addEventListener("onWidgetLoad", (obj) => {
    const fieldData = obj.detail.fieldData;
  	channelName  = obj["detail"]["channel"]["username"];
    cmd        = fieldData["command"]; 
    voz        = fieldData["voz"]; volumen = fieldData["volumen"];
    isUser     = fieldData["isUser"]; pre = fieldData["pre"];
    isGuion    = fieldData["isGuion"];
    useCmd     = fieldData["useCmd"];
    useReward  = fieldData["useReward"];
    useDefault = fieldData["useDefault"];
    reward     = fieldData["reward"];
    all        = fieldData["all"];
    inT        = fieldData["inT"];
    outT       = fieldData["outT"];
    boolMsg    = fieldData["boolMsg"];
   	configPermiso(fieldData);
  	setRewards(channelName);
    service = voz.includes("es")? "Google" : "Polly";
    audio  = document.querySelector("#audio");
    source = document.querySelector( "#source");
    audio.addEventListener("ended", end);
    document.querySelector("#audioG").addEventListener("ended", end);
});

window.addEventListener("onEventReceived", (obj) => {
    if(test(obj)) return;
  	let command = cmd + " ";
    let data = obj.detail.event.data;
  	let id = obj.detail.event.data.tags["custom-reward-id"];
    let isDefault = obj.detail.event.data.tags["msg-id"] === "highlighted-message";
  	if (!data.text.startsWith(command) && id == undefined && !isDefault) {
        console.log("no empieza con " + cmd);
        return;
    }
    let badges = data.badges;
  	let isPermit = havePermission(badges, data.nick);
  	if(isPermit) {
      let input = data.text;
      if(!continuar(id, isDefault, input)) return;
      let txt = input.startsWith(command) ? input.substring(command.length) : input;
      let msg = txt;
      if(banW(txt)) return;
      txt = isUser?((isGuion? data.nick.replace("_"," ") 
                     : data.nick) + " " + pre + " " + txt) : (pre + " " + txt);
      let txt2 = newText(txt);
      console.log("paused ->" + !elements.audio.paused + " " + !elements.audioG.paused);
      if(!elements.audio.paused || !elements.audioG.paused) {
        textoPendiente.push(txt2);
        let pen = {txtPen: txt, dataPen: data };
        showPendiente.push(pen);
        if(boolMsg) showMessage(data, msg);
        return;
	  }
      if(txt2.length > 1) {
        for(let i = 1; i < txt2.length; i++ ) {
          textoPendiente.push(txt2[i]);
        }
        if(service == "Polly") playTTS(txt2[0], voz);
      	else ttsGoogle(txt2[0], voz);
        if(boolMsg) showMessage(data, msg);
      } else {
        if(service == "Polly") playTTS(txt, voz);
        else ttsGoogle(txt, voz);
        if(boolMsg) showMessage(data, msg);
      }
      
    } else {
      console.log("no tiene permiso");
      return;
    }
});

const banW = (txt) => {
  if(banWords.lenght > 0) {
    for(let s of banWords) {
      if(txt.includes(s)) return true;
    }
  }
  return false;
}

const showMessage = (data, txt) => {
  	let message = attachEmotes(data, txt);
  	console.log("message");
    console.log(message);
    let badges = "", badge;
    for (let i = 0; i < data.badges.length; i++) {
        badge = data.badges[i];
        badges += `<img alt="" src="${badge.url}" class="badge"> `;
    }
    console.log(badges);
    let username = data.displayName + ":";
    const color = data.displayColor !== "" ? data.displayColor : "#" + (md5(username).substr(26));
    username = `<span style="color:${color}">${username}</span>`;
    let uid = data.userId; 
    let msgId = data.msgId;
    const element = `
    <div data-sender="${uid}" data-msgid="${msgId}" class="message-row animated" id="msg-0">
        <div class="user-box">
			${badges}${username} 
			<span class="user-message">${message}</span>
		</div>
    </div>`;
  	console.log(element);
    $("#main").html(element);
    $("#main").removeClass(outT + "Out initialHide");
    $("#main").addClass(inT + "In");
}

const attachEmotes = (msg, txt) => {
    let text = html_encode(txt);
    let data = msg.emotes;
    return text
        .replace(
            /([^\s]*)/gi,
            (m, key) => {
                let result = data.filter(emote => {
                    return html_encode(emote.name) === key
                });
                if (typeof result[0] !== "undefined") {
                    let url = result[0]["urls"][1];
                    return `<img alt="" src="${url}" class="badge"/>`;
                } else return key;

            }
        );
}

const end = () => {
  $("#main").removeClass(inT  + "In");
  $("#main").addClass(outT  + "Out");
  if(textoPendiente.length > 0 && elements.audio.paused && elements.audioG.paused) {
    let txt = textoPendiente[0];
  	if(service == "Polly") playTTS(txt, voz);
    else ttsGoogle(txt, voz);
    if(showPendiente.length > 0){
      console.log(txt[0].trim());
      let msgPen = showPendiente[0].txtPen;
      let dataPen = showPendiente[0].dataPen;
      console.log(msgPen);
      console.log(msgPen.includes(txt[0].trim()));
      if(msgPen.includes(txt[0].trim())) {
        showMessage(dataPen, msgPen);
        textoPendiente.splice(0, 1);
      }
    }
    textoPendiente.splice(0, 1);
  }
}

const continuar = (id, isDefault, input) => {
  let bolReward = false;
  if(id != undefined) {
    bolReward = customRewards[id].name == reward && useReward;
  }
  let bolDefault = isDefault && useDefault;
  let bolCmd = input.startsWith(cmd) && useCmd;
  console.log("permiso " + (bolReward && bolDefault && bolCmd));
  console.log(bolReward + " " + bolDefault + " " + bolCmd);
  return bolReward || bolDefault || bolCmd;
}

const configPermiso = (fieldData) => {
  let possibleBadges = ["subscriber", "vip", "moderator", "founder"];
  permitBadge = ["broadcaster"];
  for(let x of possibleBadges) {
    if(fieldData[x]) permitBadge.push(x);
    if(x == "founder" && fieldData["subscriber"]) permitBadge.push(x);
  }
  userPermit = fieldData["listUser"];
  userPermit = userPermit.replace(/\s/g, "").toLowerCase();
  userPermit = userPermit.split(",");
  banWords = fieldData["listBans"];
  banWords = banWords.replace(/\s/g, "").toLowerCase();
  banWords = banWords.split(",");
}

const havePermission = (badges, nick) => {
  if(all) return true;
  let badgeBol = badges.some(b => permitBadge.includes(b.type));
  let userBol  = userPermit.includes(nick);
  console.log(badgeBol + " " + userBol);
  return badgeBol || userBol;
}

const setRewards = (channelName) => {
  $.get({
     type: "GET",
     url: `https://api.jebaited.net/twitchItems/${channelName}`,
     success: function(data) {
       let obj = JSON.parse(data);
       let rewards = obj[0].data.community.channel.communityPointsSettings.customRewards;
       for(let reward of rewards) {
         customRewards[reward["id"]] = {"cost": reward["cost"], "name": reward["title"]};
       }
       console.log(customRewards);
     }
   }); 
}

const html_encode = (e) => {
    return e.replace(/[<>"^]/g, function (e) {
        return "&#" + e.charCodeAt(0) + ";";
    });
}

const callAPI = async (url) => {
  const speak = await fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      }
    }).then(
      (res) => {
        console.log(res);
        return res.json();
      },
      (err) => {
        callAPI(url);
      }
    );
   return speak;
}

const playTTS = (text, idioma) => {
  const audio = elements.audio;
  let url = `${TTS_BASE}?voice=${idioma}&text=${encodeURIComponent(text)}`;
  elements.source.src = url;
  audio.load();
  audio.volume = (volumen / 100);
  audio.play();
}


const ttsGoogle = (msg, idioma) => {
  console.log('google');
  const audio = elements.audioG;
  const message = encodeURIComponent(msg);
  const messageLength = message.length;
  let url = `${TTS_BASEG}=${messageLength}&q=${message}`;
  url += `&tl=${idioma}&ttsspeed=1`
  elements.sourceG.src = url;

  audio.load();
  audio.volume = (volumen / 100);
  audio.play();
}

const test = (obj) => {
  if (obj.detail.event) {
    if (obj.detail.event.listener === "widget-button") {
      console.log(obj);
      if (obj.detail.event.field === "test-tts") {
        let txt = isUser ? ((isGuion? channelName.replace("_"," ") : channelName) + " " + pre + " Esto es una Prueba") : pre + " Esto es una Prueba";
        console.log(txt);
        if(service == "Polly") playTTS(txt, voz);
      	else ttsGoogle(txt, voz);
      	if(boolMsg) {
          let element = 
          '<div data-sender="232038609" data-msgid="a40a5ebb-ae1f-4a59-8e3e-7920167d3cdd" class="message-row animated" id="msg-0">'+
		  '<div class="user-box"><img alt="" src="https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3" class="badge">'+
          '<span style="color:#008df7">'+ channelName + ':</span></div><div class="user-message">Esto es una Pruebas</div></div>';
          
          $("#main").html(element);
    	  $("#main").removeClass(outT + "Out initialHide");
    	  $("#main").addClass(inT + "In");
        }
        return true;
      }
    }
  }
  return false;
}

const newText = (txt) => {
  let txt2 = txt.split(" ");
  let newTxt = "";
  let vecTxt = [];
  for(let i = 0; i < txt2.length; i++) {
    if((newTxt.length + txt2[i].length + 1) <= 180) {
        newTxt += " " + txt2[i];
    } else {
        if(txt2[i].length > 180) {
          vecTxt.push(txt2[i].match(/.{1,3}/g))
        } else {
          vecTxt.push(newTxt);
          newTxt = txt2[i];
        }
    }
  }
  if(newTxt != "")vecTxt.push(newTxt);
  return vecTxt;
}