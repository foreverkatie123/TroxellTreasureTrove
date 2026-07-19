      // ---------------- Dice Sound FX (procedural, no audio assets) ----------------
      // Each material's "Sound" column is synthesized with plain Web Audio oscillators/noise
      // rather than sample files, so the whole feature stays self-contained and works offline.
      const DiceSoundFX = (function(){
        let ctx = null;
        let lastPlay = 0;

        function getCtx(){
          if(ctx) return ctx;
          try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(err){ ctx = null; }
          return ctx;
        }
        function envGain(ac, peak, attack, decay, t0){
          const g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t0 + attack);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
          return g;
        }
        function noiseBuffer(ac, seconds){
          const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * seconds)), ac.sampleRate);
          const data = buf.getChannelData(0);
          for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          return buf;
        }
        function tone(ac, freq, type, gainNode, t0, duration, glideTo){
          const osc = ac.createOscillator();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, t0);
          if(glideTo) osc.frequency.exponentialRampToValueAtTime(freq * glideTo, t0 + duration);
          osc.connect(gainNode);
          osc.start(t0);
          osc.stop(t0 + duration + 0.05);
        }
        function burst(ac, gainNode, t0, duration, filterFreq, filterQ){
          const src = ac.createBufferSource();
          src.buffer = noiseBuffer(ac, duration + 0.05);
          let node = src;
          if(filterFreq){
            const f = ac.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = filterFreq;
            f.Q.value = filterQ || 1;
            src.connect(f);
            node = f;
          }
          node.connect(gainNode);
          src.start(t0);
          src.stop(t0 + duration + 0.05);
        }

        const SYNTH = {
          clang(ac, t, vol){
            const g = envGain(ac, 0.5 * vol, 0.002, 0.55, t); g.connect(ac.destination);
            tone(ac, 620, 'square', g, t, 0.5, 0.6);
            tone(ac, 930, 'triangle', g, t, 0.35);
            burst(ac, g, t, 0.08, 2800, 3);
          },
          ting(ac, t, vol){
            const g = envGain(ac, 0.35 * vol, 0.001, 0.9, t); g.connect(ac.destination);
            tone(ac, 2100, 'sine', g, t, 0.85, 0.97);
            tone(ac, 3150, 'sine', g, t, 0.6, 0.97);
          },
          click(ac, t, vol){
            const g = envGain(ac, 0.4 * vol, 0.001, 0.06, t); g.connect(ac.destination);
            burst(ac, g, t, 0.05, 1800, 6);
          },
          clack(ac, t, vol){
            const g = envGain(ac, 0.45 * vol, 0.001, 0.12, t); g.connect(ac.destination);
            tone(ac, 180, 'square', g, t, 0.1);
            burst(ac, g, t, 0.06, 900, 2);
          },
          thunk(ac, t, vol){
            const g = envGain(ac, 0.5 * vol, 0.002, 0.22, t); g.connect(ac.destination);
            tone(ac, 130, 'sine', g, t, 0.2, 0.7);
          },
          chime(ac, t, vol){
            const g = envGain(ac, 0.32 * vol, 0.001, 0.7, t); g.connect(ac.destination);
            tone(ac, 1300, 'sine', g, t, 0.65, 1.02);
            tone(ac, 1950, 'sine', g, t, 0.5, 1.02);
            tone(ac, 2600, 'sine', g, t, 0.4, 1.02);
          },
          deepknock(ac, t, vol){
            const g = envGain(ac, 0.55 * vol, 0.002, 0.4, t); g.connect(ac.destination);
            tone(ac, 70, 'sine', g, t, 0.38, 0.6);
          },
          magical(ac, t, vol){
            const g = envGain(ac, 0.3 * vol, 0.001, 0.5, t); g.connect(ac.destination);
            [660, 880, 1100].forEach((f, i) => tone(ac, f, 'triangle', g, t + i * 0.03, 0.4, 1.05));
          }
        };

        // intensity in [0,1] - callers scale it from impact speed so hard bounces sound louder
        function play(soundId, intensity){
          const ac = getCtx();
          if(!ac) return;
          const now = ac.currentTime;
          if(now - lastPlay < 0.07) return; // debounce rapid-fire contacts while settling
          lastPlay = now;
          const vol = Math.max(0.12, Math.min(1, intensity));
          const fn = SYNTH[soundId] || SYNTH.click;
          try{ fn(ac, now, vol); }catch(err){ /* audio is best-effort, never blocks the roll */ }
        }

        return { play };
      })();

