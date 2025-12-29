/*
--------------------------------
        SOUND VISUALIZER
--------------------------------
This code was made by Matúš Majer, as a part of final assignment for Creative Programming.

NOTE: To "start" the experience, you need to manually start it by pressing Spacebar. This is due to how Chrome/Firefox handle autoplay on websites. 
It can be done with auto-start, but it'd require system setting changes, or running inside p5 web editor on their platform. So just press Space and jam out.
*/

/*
--------------------------------
          VARIABLES
--------------------------------
*/
// -------- SOUND STUFF --------
let song;
let fft, filter, reverb;
// adjust numBars if you're having performance issues. I recommend to have it at 128 but feel free to adjust. Adjust circle audio visualizer density.
const numBars = 128;
let filterType = "lowpass";
let filterOn = false; 
let isPaused = true; // Track song playback state

// -------- VISUAL STUFF --------
// you can change the starting point of the colors displayed here, but they all circulate quite fast
let hueShift = 0;
// offset controls UI offset between itself and the edges of the screen. 20 works well on mine but feel free to mess around, it should work fine with almost any number >14 (default line height).
const offset = 20;
// these two control line thickness. I like it at 10 and 2, but you can mess around with it if you really feel like it.
const circleWeight = 10;
const lineWeight = 2;
// song selector UI
let mySelect;
let songName;
// song upload UI
let uploadButton;
let uploadedFiles = {}; // store file blobs by name


// Panning slider UI
let panSlider;
let panValue = 0;


// Song list - feel free to expand on this, just ensure that the name here corresponds to the name of the file. Only works in MEDIA folder!
// Use this if you want your song to be PERMANENTLY available in the sketch. 
// For temporary use, you can upload your own thingy with the "browse" button
let songList = [
  'Gorillaz - 19-2000', 
  'Flume - Hyperreal', 
  'Rob Zombie - Dragula', 
  'Chet Faker - Whatever Tomorrow (Soulwax Remix)', 
  'Tame Impala - Dracula'
]


// -------- PRELOAD --------
function preload() {
  // we make the UI of the dropdown here, at position 10, 10
  mySelect = createSelect();
  mySelect.position(offset, offset);
  // Make select option for any number of songs. If you added 20, 20 will show up.
  for(let i = 0; i <= songList.length; i++)
  {
    mySelect.option(songList[i]);
  }
  // select random one to be the "first". Otherwise I was going insane from the same intro all the time. Floor to ensure it doesn't overflow.
  mySelect.selected(songList[floor(random(0, songList.length))]);
  songName = mySelect.value();

  // Panning slider
  panSlider = createSlider(-1, 1, 0, 0.01);  // min, max, default, step
  panSlider.position(offset, offset * 2.5);
  panSlider.style('width', '200px');

  
  // Finally, load the song.
  song = loadSound(`media/${songName}.mp3`);
}

// -------- SETUP --------
function setup() {
  // Canvas
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);
  colorMode(HSB);
  noStroke();

  // Audio
  filter = new p5.LowPass();
  reverb = new p5.Reverb();
  song.connect(filter); 
  filter.connect(reverb);
  reverb.amp(0.6);
  
  // FFT is absolutely crucial in this sketch, so we make a new FFT object.
  fft = new p5.FFT();

  // Upload MP3 button
  uploadButton = createFileInput(handleUploadFile);
  uploadButton.position(width-offset * 4, offset);   
  uploadButton.attribute('accept', '.mp3'); // Only allow MP3   
}



// -------- DRAW --------
// (a.k.a) where the good stuff happens
function draw() {
  // Fading background for trail effect. You can play around with the number "40" here, up to your liking. Higher number = more glowy.
  background(0, 0, 5, 40);
  panValue = panSlider.value();
  song.pan(panValue);

  uploadButton.changed(() => {

    }
  );
  mySelect.changed(() => {
    
    songName = mySelect.value();
    song.stop();
    let selected = mySelect.value();

    // If it's a built-in song, load from media/
    if (songList.includes(selected) && !(selected in uploadedFiles)) {
      song = loadSound(`media/${selected}.mp3`, () => {
        if (!isPaused) song.play();
      });
    }
    // If it was uploaded by the user, load from blob
    else if (uploadedFiles[selected]) {
      song = loadSound(uploadedFiles[selected].data, () => {
        if (!isPaused) song.play();
      });
    }

    // reset filters
    if (filterOn)
    {
      filterOn = false;
    }
  });

  // Map mouse to filter parameters
  mousePos = map(mouseX, 0, width, 0, 1);
    // using custom logarithmic mapping to ensure the mouseX filters the sounds as smoothly as possible. See below for the function itself
  let frequency = logMap(mousePos, 0, 1, 20, 20000);
  let resonance = map(mouseY, 0, height, 0, 20);

  // Only apply filter if it's supposed to be active
  if (filterOn) {
    filter.freq(frequency);
    filter.res(resonance);
  }

  // Analyze sound, FFT algorithm makes the whole thing possible.
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");

  // Calculate color (modulo 360 to cycle them), then prepare circleSize based on bass.
  hueShift = (hueShift + 0.5) % 360;
  let circleSize = map(bass, 0, 255, 150, 400);


  // Circular frequency visualizer
  push();
  // start in the middle
  translate(width / 2, height / 2);
  noFill();
  strokeWeight(lineWeight);

  // iterate over frequency bins and draw lines. Starts on the right side and goes clockwise. 
  for (let i = 0; i < numBars; i++) {
    // if you want to start it on top, add -90 to the angle after mapping calculation (uncomment line 103).
    let angle = map(i, 0, numBars, 0, 360);
    // angle -= 90;

    // -------- SPECTRUM ANALYSIS --------
    // simple mapping from 0-numBars to 0-512 (FFT "relevant" bins)
    let spectrumCoefficient = int(map(i, 0, numBars, 0, 512));
    // get the amplitude from the correct bin (if let only spetrum[i], you don't get a full range)
    let amp = spectrum[spectrumCoefficient]; 
  
    // amplitude affects the position of the line - from 150 to 300 px from center, depending on sound energy.
    // the idea is that higher amplitude = further from center.
    let r = map(amp, 0, 255, 150, 300);
    // cosine and sine for circular distribution and "pointing" in the right direction no matter the amplitude. StackOverflow helped with this.
    let x = r * cos(angle);
    let y = r * sin(angle);

    // -------- DRAWING THE LINES --------
    // set stroke color based on angle and overall hueShift, with saturation based on overall sound energy.
    stroke((angle + hueShift) % 360, amp, 255);
    // we don't use x or y in the first part of the line to ensure it always starts from the circle edge. It's kind of a wonky math but it works, we don't question it.
    // since we translated to the middle, we need only half the circle size

    line((circleSize / 2) * cos(angle), (circleSize / 2) * sin(angle), x, y);
  }
  pop();

  // -------- MAIN CIRCLE --------
  // note to self - moved here to have it ABOVE the lines, not under
  strokeWeight(circleWeight);
  // this stroke uses overall energy for saturation, so colors only change with the music, not frequency-specific. Adjust range (20-10000) to see specific frequencies.
  stroke(hueShift, fft.getEnergy(20,10000), 255);
  noFill();
  ellipse(width / 2, height / 2, circleSize, circleSize);

  /* 
  ------------------------
        UI ELEMENTS
  ------------------------
  */
  // basic settings
  noStroke();
  fill(255);

  // if Paused, display prompt (so users know how to start it)
  if(isPaused)
  {
    textAlign(CENTER);
    textSize(64);
    text("PRESS SPACEBAR TO PLAY", width/2, offset*6);
  }
  
  // Current status
  textSize(14);
  textAlign(LEFT);
  // the first and likely only time I'll use this way of doing the conditionals, but would be a LOT of if statements otherwise.
  // line heights are calculated to 20 px with textSize 14. Could probably do something with em textsize for accessibility but nyeh. Not today.
  text(`Pan: ${nf(panValue, 1, 2)}`, offset, offset * 5);
  
  text(`Filter type: ${filterType}`, offset, height - (offset * 5));
  text(`Effects: ${filterOn ? "ON" : "OFF"}`, offset, height - (offset * 4));
  text(`Playback: ${isPaused ? "PAUSED" : "PLAYING"}`, offset, height - (offset * 3));
  text(`Freq: ${int(frequency)} Hz`, offset, height - (offset * 2));
  text(`Resonance: ${resonance.toFixed(2)}`, offset, height - offset);

  // different text alignment because it makes easier calculations.
  textAlign(RIGHT);
  text("[1]=LowPass  [2]=HighPass  [3]=BandPass", width - offset, height - (offset * 2));
  text("[E]=Toggle Effects  [SPACE]=Pause/Resume", width - offset, height - offset);
}

/* 
  ------------------------
          KEY BINDS
  ------------------------
  */


function keyPressed() {
  // Filter type switching
  if (key === '1' || key === '2' || key === '3') {
    // don't switch types if effects are off - prevents some shennanigans that otherwise happen.
    if (!filterOn) return; 

    // first disconnect current filter
    filter.disconnect();
    // this can be expanded further. Don't forget to add corresponding UI elements!
    if (key === '1') {
      filter = new p5.LowPass();
      filterType = "lowpass";
    } else if (key === '2') {
      filter = new p5.HighPass();
      filterType = "highpass";
    } else if (key === '3') {
      filter = new p5.BandPass();
      filterType = "bandpass";
    }

    // now reconnect the song with correct filter
    song.disconnect();
    song.connect(filter);
    filter.connect(reverb);
  }

  // Toggle effects on/off with 'E'
  if (key === 'E' || key === 'e') {
    if (filterOn) {
      // Turn off filters and reverb — play "raw" signal. Just disconnecting and connecting is the easiest implementation. Could just mess with the values but I encountered some audio tearing.
      song.disconnect();
      song.connect(); 
      filterOn = false;
    } else {
      // Turn CORRECT effects back on
      reverb = new p5.Reverb();
      reverb.amp(0.6);

      if (filterType === "lowpass") {
        filter = new p5.LowPass();
      } else if (filterType === "highpass") {
        filter = new p5.HighPass();
      } else if (filterType === "bandpass") {
        filter = new p5.BandPass();
      }

      song.disconnect();
      song.connect(filter);
      filter.connect(reverb);
      filterOn = true;
    }
  }

  // Pause / Resume song with Spacebar -- CHANGE THE KEYBIND PLS
  if (keyCode === 32) { // 32 = spacebar
    if (song.isPlaying()) {
      song.pause();
      isPaused = true;
    } else {
      song.play();
      isPaused = false;
    }
  }

  if (key === 'R' || key === 'r') {
    panValue = 0;
    panSlider.position = 0;
  }
}

/* 
  ------------------------
        CUSTOM FUNCTIONS
  ------------------------
  */


/*  
    Custom logarithmic mapping function.
    BIG THANKS to my friend Ben for pointing out that sound frequency perception is logarithmic!
    otherwise this is just maths. we love math(s)! 
    P.S.: P5 should have this natively.
*/
function logMap(value, start1, stop1, start2, stop2) {
  let normalizedValue = map(value, start1, stop1, 0, 1, true);
  let logMin = Math.log(start2);
  let logMax = Math.log(stop2);
  let logValue = logMin + (logMax - logMin) * normalizedValue;
  let finalValue = Math.exp(logValue);
  return finalValue;
}

// HANDLE UPLOADED SONGS
function handleUploadFile(file) {
  // Only accept MP3
  if (file.type !== 'audio' || !file.name.endsWith('.mp3')) {
    alert("Please upload an MP3 file.");
    return;
  }

  // Strip extension to use as display name
  let baseName = file.name.replace('.mp3', '');

  // Avoid duplicates
  if (songList.includes(baseName)) {
    alert("This song is already in your song list!");
    return;
  }

  // Add to songList
  songList.push(baseName);

  // Add to dropdown
  mySelect.option(baseName);
  mySelect.selected(baseName);

  // Store blob
  uploadedFiles[baseName] = file;

  // STOP current song
  if (song && song.isPlaying()) song.stop();

  // LOAD + PLAY the uploaded song automatically
  song = loadSound(file.data, () => {
    isPaused = false;
    song.play();

    // reconnect effects (same behavior as your dropdown change)
    if (filterOn) {
      reverb = new p5.Reverb();
      reverb.amp(0.6);

      if (filterType === "lowpass")      filter = new p5.LowPass();
      else if (filterType === "highpass") filter = new p5.HighPass();
      else if (filterType === "bandpass") filter = new p5.BandPass();

      song.disconnect();
      song.connect(filter);
      filter.connect(reverb);
    } else {
      song.disconnect();
      song.connect();
    }
  });

  console.log("Uploaded & playing:", baseName);
}



function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
} 