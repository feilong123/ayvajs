// ayva 核心
import { Ayva } from 'index.js';

const config = {
    name: 'OSR2+',      // Optional name of the config.
    defaultAxis: 'L0', // Optional default axis. When an axis is not specified in commands, this axis is used.
    frequency: 25,     // Optional. The frequency of updates to devices in Hz. The default is 50.
    axes: [{
      name: 'L0',
      type: 'linear',
      alias: 'stroke'
    }, {
      name: 'R1',
      type: 'rotation',
      alias: 'roll'
    }, {
      name: 'R2',
      type: 'rotation',
      alias: 'pitch',
    },]
  };
  const ayva = new Ayva(config);
  // ayva.addOutput(emulator);
  
  ayva.addOutput(consoleLog);

  function consoleLog(commands) {
    console.log(commands)
  }

  // ayva.move({ to: 0, duration: 0.2 });

  // Execute an orbit-grind at 24 bpm
  // ayva.do(new TempestStroke('orbit-grind', 24));

  // ayva.do(new TempestStroke({
  //  stroke: { from: 0.0, to: 0.3, ecc: 0.3 },
  //  roll:   { from: 0.1, to: 0.9, phase: 1.0, ecc: -0.3 },
  //   pitch:  { from: 0.9, to: 0.1, ecc: -0.3 }
  // }));

  class FiveSecondStroke {
    constructor (speed) {
      this.speed = speed;
    }
  
    perform (ayva) {
      if (!this.startTime) {
        this.startTime = performance.now();
      }
  
      if (performance.now() - this.startTime < 5000) {
        ayva.$.stroke(0, this.speed).execute();
        ayva.$.stroke(1, this.speed).execute();  
      } else {
        // Five seconds has elapsed, so signal completion.
        this.complete = true;
      }
    }
  }
  ayva.do(new FiveSecondStroke(2));