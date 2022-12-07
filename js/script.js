'use strict';

let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

const maxLogLength = 100;
const baudRates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000];
const log = document.getElementById('log');
const butConnect = document.getElementById('butConnect');
const baudRate = document.getElementById('baudRate');


document.addEventListener('DOMContentLoaded', async () => {
  if (!'serial' in navigator) {
    $("#notSupported").show();
    console.log('Web Serial API not supported.');
  }

  butConnect.addEventListener('click', clickConnect);
  baudRate.addEventListener('change', changeBaudRate);

  initBaudRate();
  loadAllSettings();
  logData("Waiting for serial connection...");


});

$("#selectLanguage img").click(function() {
  var lang = $(this).attr("id");
  console.log(lang);
  // Add the language to session storage
  sessionStorage.setItem("lang", lang);

  // Hide the language selection
  $("#selectLanguage").hide();
  // Show the video
  $("#video").fadeIn("fast");

  $("#languageSelected").attr("src", "img/" + lang + ".png");

  goFullScreen();
});


$("#changeLanguage").click(function() {
  // Show the language selection
  $("#selectLanguage").fadeIn("fast");
  resetVideo();
  // Hide the video
  $("#video").hide();
  // Hide the connectSerial section
  $("#connectSerial").hide();
});


async function connect() {
  // - Request a port and open a connection.
  port = await navigator.serial.requestPort();

  if (port) {
    // - Open the connection.
    await port.open({ baudRate: baudRate.value });
  } else {
    logData("No serial port selected.");
  }

  let decoder = new TextDecoderStream();
  inputDone = port.readable.pipeTo(decoder.writable);
  inputStream = decoder.readable
    .pipeThrough(new TransformStream(new LineBreakTransformer()));

  reader = inputStream.getReader();
  readLoop().catch(async function(error) {
    toggleUIConnected(false);
    await disconnect();
  });

  // When connected, hide the "connectSerial" section and show the "video" section
  $("#selectLanguage").fadeIn("fast");
  $("#connectSerial").hide();
}

async function readLoop() {
  while (true) {
    const {value, done} = await reader.read();
    console.log('[readLoop] value', value);
    // Check if the value is a number
    if (value != null && !isNaN(value)) {
      changeZone(value);
    }
    if (done) {
      console.log('[readLoop] DONE', done);
      reader.releaseLock();
      break;
    }
  }
}

function goFullScreen() {
  var elem = document.getElementById("videoPlayer");

  // Check if the video is already in fullscreen
  if (document.fullscreenElement) {
    console.log("Already in fullscreen");
  } else {

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
      elem.msRequestFullscreen();
    }
  }
}

function resetVideo() {
  $("#videoPlayer").attr("src", "videos/black.mp4");
  // Add loop attribute
  $("#videoPlayer").attr("loop", "loop");
}

async function changeZone(zone) {
  // Get the language from session storage
  var lang = sessionStorage.getItem("lang");
  if (lang == null) {
    console.log("No language selected");
    return;
  }

  console.log("Changing zone to " + zone);
  

  $("#videoPlayer").attr("src", "videos/" + lang +  "/" + zone + ".mp4");
  // Remove loop attribute
  $("#videoPlayer").removeAttr("loop");

  // Toggle fullscreen if not already
  goFullScreen();

  // Play the video
  $("#videoPlayer")[0].play();

}


$("#butDisconnect").click(function() {
  disconnect();
  // When disconnected, hide the "video" section and show the "connectSerial" section
  resetVideo();
  $("#video").hide();
  $("#connectSerial").fadeIn("fast");

});

/**
 * @name disconnect
 * Closes the Web Serial connection.
 */
async function disconnect() {
  if (reader) {
    await reader.cancel();
    await inputDone.catch(() => {});
    reader = null;
    inputDone = null;
  }

  if (outputStream) {
    await outputStream.getWriter().close();
    await outputDone;
    outputStream = null;
    outputDone = null;
  }

  await port.close();
  port = null;

  logData("Disconnected");
  logData("Waiting for serial connection...");
}

function logData(line) {
  // Update the Log
  let d = new Date();
  let timestamp = d.getHours() + ":" + `${d.getMinutes()}`.padStart(2, 0) + ":" +
      `${d.getSeconds()}`.padStart(2, 0);
  log.innerHTML += '<span class="timestamp">' + timestamp + ' -> </span>';
  d = null;
  
  log.innerHTML += line+ "<br>";

  // Remove old log content
  if (log.textContent.split("\n").length > maxLogLength + 1) {
    let logLines = log.innerHTML.replace(/(\n)/gm, "").split("<br>");
    log.innerHTML = logLines.splice(-maxLogLength).join("<br>\n");
  }

  log.scrollTop = log.scrollHeight
  
}

/**
 * @name reset
 * Reset the Plotter, Log, and associated data
 */
async function reset() {
  // Clear the data
  log.innerHTML = "";
}

/**
 * @name clickConnect
 * Click handler for the connect/disconnect button.
 */
async function clickConnect() {
  if (port) {
    await disconnect();
    toggleUIConnected(false);
    return;
  }

  await connect();

  reset();

  toggleUIConnected(true);
}

/**
 * @name changeBaudRate
 * Change handler for the Baud Rate selector.
 */
async function changeBaudRate() {
  saveSetting('baudrate', baudRate.value);
}

/**
 * @name clickClear
 * Click handler for the clear button.
 */
async function clickClear() {
  reset();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @name LineBreakTransformer
 * TransformStream to parse the stream into lines.
 */
class LineBreakTransformer {
  constructor() {
    // A container for holding stream data until a new line.
    this.container = '';
  }

  transform(chunk, controller) {
    this.container += chunk;
    const lines = this.container.split('\n');
    this.container = lines.pop();
    lines.forEach(line => {
      controller.enqueue(line)
      logData(line);
    });
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}

function toggleUIConnected(connected) {
  let lbl = 'Connect';
  if (connected) {
    lbl = 'Disconnect';
  }
  butConnect.textContent = lbl;
}

function initBaudRate() {
  for (let rate of baudRates) {
    var option = document.createElement("option");
    option.text = rate + " Baud";
    option.value = rate;
    baudRate.add(option);
  }
}

function loadAllSettings() {
  // Load all saved settings or defaults
  baudRate.value = loadSetting('baudrate', 9600);
}

function loadSetting(setting, defaultValue) {
  let value = JSON.parse(window.localStorage.getItem(setting));
  if (value == null) {
    return defaultValue;
  }

  return value;
}

function saveSetting(setting, value) {
  window.localStorage.setItem(setting, JSON.stringify(value));
}