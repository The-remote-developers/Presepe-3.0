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

$("#selectLanguage img").click(function() {
  var lang = $(this).attr("id");
  console.log(lang);
  // Add the language to the url query
  var url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.location.href = url;
});


$("#changeLanguage").click(function() {
  // Remove the language from the url query
  var url = new URL(window.location.href);
  url.searchParams.delete('lang');
  window.location.href = url;
});

document.addEventListener('DOMContentLoaded', async () => {
  if (!'serial' in navigator) {
    $("#notSupported").show();
    console.log('Web Serial API not supported.');
  }
  
  // Check if the language is set in the url query
  var url = new URL(window.location.href);
  var lang = url.searchParams.get("lang");
  if (lang != null) {
    $("#languageSelected").attr("src", "img/" + lang + ".png");
    // Hide the language selector
    $("#selectLanguage").addClass("hidden");
    // Show the connect section
    $("#connectSerial").removeClass("hidden");

    butConnect.addEventListener('click', clickConnect);
    baudRate.addEventListener('change', changeBaudRate);

    initBaudRate();
    loadAllSettings();
    logData("Waiting for serial connection...");
  } else {
    // Show the language selector
    $("#selectLanguage").fadeIn("fast");
  }

});

async function connect() {
  try {
    // - Request a port and open a connection.
    port = await navigator.serial.requestPort();
      
    // - Wait for the port to open.toggleUIConnected
    await port.open({ baudRate: baudRate.value });
  } catch (e) {
    // - Catch any errors and log them.
    $("#notSupported").show();
    logData("Web Serial API error: " + e);
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
  $("#connectSerial").addClass("hidden");
  $("#video").removeClass("hidden");

  goFullScreen();
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

async function changeZone(zone) {
  console.log("Changing zone to " + zone);
  var urlLang = new URL(window.location.href);
  var lang = urlLang.searchParams.get("lang");
  if (lang == null) {
    // Remove the language from the url query
    var url = new URL(window.location.href);
    url.searchParams.delete('lang');
    window.location.href = url;
  }

  $("#videoPlayer").attr("src", "videos/" + lang +  "/" + zone + ".mp4");
  // Remove loop attribute
  $("#videoPlayer").removeAttr("loop");

  // Toggle fullscreen if not already
  goFullScreen();

  // Open a video in fullscreen
  // var video = window.open("videos/" + lang +  "/" + zone + ".mp4", "Video", "scrollbars=no,status=yes,titlebar=no,toolbar=no,menubar=no");
}


$("#butDisconnect").click(function() {
  disconnect();
  // When disconnected, hide the "video" section and show the "connectSerial" section
  $("#video").addClass("hidden");
  $("#connectSerial").removeClass("hidden");
  // Reset the video
  $("#videoPlayer").attr("src", "");

  // Reset ui
  toggleUIConnected(false);
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