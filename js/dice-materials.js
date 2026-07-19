      // ---------------- Dice Materials & Trails ----------------
      // Bounce/weight are qualitative labels from the material table; they map to concrete
      // Matter.js body parameters below so each material actually feels different to throw,
      // not just look different.
      const DICE_MATERIALS = [
        { id:'metal', label:'Metal', bounce:'low', weight:'heavy', soundId:'clang', visual:'reflections', color:0xb9c2c9, accent:0xffffff },
        { id:'crystal', label:'Crystal', bounce:'medium', weight:'light', soundId:'ting', visual:'glow', color:0x7ad4e0, accent:0xffffff },
        { id:'bone', label:'Bone', bounce:'medium', weight:'medium', soundId:'click', visual:'matte', color:0xe8dfc8, accent:0xcfc6ae },
        { id:'stone', label:'Stone', bounce:'low', weight:'heavy', soundId:'clack', visual:'dust', color:0x8c8c86, accent:0x6b6b66 },
        { id:'wood', label:'Wood', bounce:'high', weight:'light', soundId:'thunk', visual:'grain', color:0xa9713c, accent:0x7a4e26 },
        { id:'gemstone', label:'Gemstone', bounce:'medium', weight:'medium', soundId:'chime', visual:'refraction', color:0xd15ac0, accent:0xffffff },
        { id:'obsidian', label:'Obsidian', bounce:'low', weight:'heavy', soundId:'deepknock', visual:'darkglow', color:0x241b2e, accent:0x8a4fd1 },
        { id:'dragonscale', label:'Dragon Scale', bounce:'medium', weight:'medium', soundId:'magical', visual:'embers', color:0xd1605a, accent:0xffb347 }
      ];
      const DICE_TRAILS = [
        { id:'none', label:'None', color:null },
        { id:'arcane', label:'Arcane', color:0x9f5ae0 },
        { id:'fire', label:'Fire', color:0xff8c3c },
        { id:'ice', label:'Ice', color:0xaee6ff },
        { id:'lightning', label:'Lightning', color:0xfff066 },
        { id:'necrotic', label:'Necrotic', color:0x7a3fa0 },
        { id:'holy', label:'Holy', color:0xffe27a },
        { id:'blood', label:'Blood', color:0x8a1f1f },
        { id:'shadow', label:'Shadow', color:0x54545e }
      ];
      const BOUNCE_RESTITUTION = { low:0.38, medium:0.58, high:0.78 };
      const WEIGHT_PHYSICS = {
        heavy:  { density:0.008, frictionAir:0.045, speedMul:0.85, spinMul:0.7 },
        medium: { density:0.005, frictionAir:0.03,  speedMul:1.0,  spinMul:1.0 },
        light:  { density:0.003, frictionAir:0.02,  speedMul:1.2,  spinMul:1.35 }
      };
      function findMaterial(id){ return DICE_MATERIALS.find(m => m.id === id) || DICE_MATERIALS[1]; }
      function findTrail(id){ return DICE_TRAILS.find(t => t.id === id) || DICE_TRAILS[0]; }
      // Trail choice while airborne, material choice on landing (Fire/Ice/Arcane/Lightning/etc. all
      // get a themed burst); with no trail selected, the landing burst falls back to the material.
      function landingEffectKind(material, trail){
        if(trail.id !== 'none'){
          return {
            arcane:'magic-circle', fire:'poof-embers', ice:'frost-ring', lightning:'spark-burst',
            necrotic:'smoke-cloud', holy:'gold-burst', blood:'blood-splatter', shadow:'dark-burst'
          }[trail.id];
        }
        return {
          metal:'dust-puff', crystal:'sparkle-burst', bone:'dust-puff', stone:'dust-puff',
          wood:'wood-chips', gemstone:'sparkle-burst', obsidian:'dark-burst', dragonscale:'ember-burst'
        }[material.id];
      }

