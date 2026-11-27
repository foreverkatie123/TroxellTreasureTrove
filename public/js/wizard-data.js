// Extra data for the guided character wizard (public/js/wizard.js).
// Loaded AFTER dnd-data.js and BEFORE the sheet script, so the additions below
// (Artificer, 2024 subclass names) also show up in the full character sheet.
// All descriptions here are short plain-language summaries written for this app —
// they are not copied from any rulebook.
(function(){
  const D = window.DND;
  if(!D){ console.warn('wizard-data.js: window.DND missing (load dnd-data.js first)'); return; }

  // ---------- Artificer (Tasha's) — not in dnd-data.js, so register it ----------
  D.SUBCLASSES.Artificer = ['Alchemist','Armorer','Artillerist','Battle Smith'];
  if(!D.SUBCLASSES.Wizard.includes('Order of Scribes')) D.SUBCLASSES.Wizard.push('Order of Scribes');
  D.CLASS_HIT_DIE.Artificer = 8;
  D.CLASS_SAVE_PROFS.Artificer = ['con','int'];
  D.SPELLCASTING_ABILITY.Artificer = 'int';
  D.HALF_CASTERS.add('Artificer');
  D.CANTRIPS_KNOWN.Artificer = [2,2,2,2,2,2,2,2,2,3,3,3,3,4,4,4,4,4,4,4];
  D.CLASS_SKILL_CHOICES.Artificer = { count: 2, options: ['Arcana','History','Investigation','Medicine','Nature','Perception','Sleight of Hand'] };
  D.CLASS_FEATURES.Artificer = [
    [1,'Magical Tinkering','Give a tiny object a small magical trick (a light, a sound, a short message, a smell). Works on a number of objects equal to your Int modifier.'],
    [1,'Spellcasting','Int-based. You prepare spells each day (Int mod + half your artificer level, minimum 1). Tools can act as your spellcasting focus.'],
    [2,'Infuse Item','After a long rest, imbue ordinary gear with magical infusions you know.'],
    [3,'Artificer Specialist','Choose your subclass.'],
    [3,'The Right Tool for the Job','Spend an hour to magically create a set of artisan\'s tools.'],
    [6,'Tool Expertise','Your proficiency bonus is doubled for tools you are proficient with.'],
    [7,'Flash of Genius','Reaction: add your Int modifier to an ability check or saving throw made by you or a creature within 30 ft.'],
  ];

  const WZ = {};

  // ---------- Class cards ----------
  // diff: 1 = beginner friendly, 2 = moderate, 3 = more to track
  WZ.CLASS_INFO = {
    Fighter:   { tag:'Master of weapons and armor — reliable and easy to learn', tags:['fighting','tank'], diff:1,
                 does:['Attack with weapons and wear heavy armor','Take hits so friends don\'t have to','Recover your own health with Second Wind'], key:'Strength or Dexterity, then Constitution' },
    Barbarian: { tag:'Fearless brawler who gets tougher when enraged', tags:['fighting','tank'], diff:1,
                 does:['Rage to hit harder and take less damage','Charge in front and soak up attacks','No spells or complicated resources'], key:'Strength, then Constitution' },
    Rogue:     { tag:'Sneaky expert who deals big damage from the shadows', tags:['stealth','fighting'], diff:1,
                 does:['Sneak Attack for extra damage when you have an edge','Dash, hide or slip away as a bonus action','Best at skills and picking locks'], key:'Dexterity, then Constitution' },
    Monk:      { tag:'Fast martial artist who strikes many times per turn', tags:['fighting','stealth'], diff:2,
                 does:['Fight unarmed and unarmored','Spend ki points on flurries and special moves','Move quickly and dodge well'], key:'Dexterity and Wisdom' },
    Paladin:   { tag:'Armored holy warrior who smites foes and protects friends', tags:['fighting','support','magic'], diff:2,
                 does:['Wear heavy armor and fight in melee','Smite with radiant power by spending spell slots','Heal with Lay on Hands (spells start at level 2)'], key:'Strength and Charisma' },
    Ranger:    { tag:'Wilderness hunter with a bow, tracking and a little magic', tags:['fighting','stealth'], diff:2,
                 does:['Shoot or fight with two weapons','Track and survive in the wild','Gain nature spells from level 2'], key:'Dexterity and Wisdom' },
    Cleric:    { tag:'Divine caster who heals allies and smites foes', tags:['magic','support','tank'], diff:2,
                 does:['Heal and protect your party with prayers','Wear armor and still cast spells','Your domain (subclass) shapes your style'], key:'Wisdom, then Constitution' },
    Bard:      { tag:'Charming performer with spells, songs and plenty of skills', tags:['magic','support'], diff:2,
                 does:['Inspire friends with Bardic Inspiration','Talk your way through problems','Learn a bit of everything'], key:'Charisma, then Dexterity' },
    Sorcerer:  { tag:'Born spellcaster with raw, flexible magic', tags:['magic'], diff:2,
                 does:['Cast spells powered by your bloodline','Bend spells with Metamagic later on','Fewer spells than a wizard, but easier to manage'], key:'Charisma, then Constitution' },
    Warlock:   { tag:'Caster empowered by a pact with a mysterious patron', tags:['magic'], diff:2,
                 does:['Blast with Eldritch Blast every turn','A few strong spell slots that refresh on a short rest','Pick up odd magical gifts called invocations'], key:'Charisma, then Constitution' },
    Druid:     { tag:'Nature caster who can turn into animals', tags:['magic','support'], diff:3,
                 does:['Cast nature spells and heal','Wild Shape into beasts from level 2','Prepare your spells each day'], key:'Wisdom, then Constitution' },
    Wizard:    { tag:'Scholar with the biggest spell list — fragile but powerful', tags:['magic'], diff:3,
                 does:['Learn many spells and keep them in a spellbook','Prepare different spells each day','Low hit points — stay behind the fighters'], key:'Intelligence, then Constitution' },
    Artificer: { tag:'Inventor who uses magical tools and gadgets (Tasha\'s)', tags:['magic','support'], diff:3,
                 does:['Cast spells through your tools','Infuse ordinary gear with magic','Sturdier than most casters'], key:'Intelligence, then Constitution' },
  };
  WZ.CLASS_ORDER = ['Fighter','Barbarian','Rogue','Monk','Paladin','Ranger','Cleric','Bard','Sorcerer','Warlock','Druid','Wizard','Artificer'];

  // Best-to-worst ability order, used by the "recommended" button (standard array / point-buy-ish)
  WZ.PRIORITY = {
    Barbarian:['str','con','dex','wis','cha','int'], Bard:['cha','dex','con','wis','int','str'],
    Cleric:['wis','con','str','cha','dex','int'],    Druid:['wis','con','dex','int','cha','str'],
    Fighter:['str','con','dex','wis','cha','int'],   Monk:['dex','wis','con','str','cha','int'],
    Paladin:['str','cha','con','wis','dex','int'],   Ranger:['dex','wis','con','str','int','cha'],
    Rogue:['dex','con','cha','wis','int','str'],     Sorcerer:['cha','con','dex','wis','int','str'],
    Warlock:['cha','con','dex','wis','int','str'],   Wizard:['int','con','dex','wis','cha','str'],
    Artificer:['int','con','dex','wis','cha','str'],
  };
  WZ.ABILITY_HINT = {
    str:'Muscle — hitting hard, climbing, lifting',
    dex:'Agility — dodging, aiming, sneaking, armor class',
    con:'Toughness — more hit points',
    int:'Book smarts — knowledge, investigating, wizard spells',
    wis:'Awareness — noticing things, reading people, cleric and druid spells',
    cha:'Presence — persuading, bard, sorcerer, warlock and paladin spells',
  };

  // ---------- Species ability bonuses (2014 rules). fixed: always applied; pick: [amounts] the player assigns to different scores ----------
  WZ.RACE_BONUS = {
    'Astral Elf':{pick:[2,1]}, 'Dark Elf (Drow)':{fixed:{dex:2,cha:1}}, 'Dragonborn':{fixed:{str:2,cha:1}},
    'Dwarf (Hill)':{fixed:{con:2,wis:1}}, 'Dwarf (Mountain)':{fixed:{str:2,con:2}}, 'Elf (High)':{fixed:{dex:2,int:1}},
    'Fairy':{pick:[2,1]}, 'Gnome (Forest)':{fixed:{dex:1,int:2}}, 'Gnome (Rock)':{fixed:{con:1,int:2}},
    'Half-Elf':{fixed:{cha:2}, pick:[1,1]}, 'Half-Orc':{fixed:{str:2,con:1}},
    'Halfling (Lightfoot)':{fixed:{dex:2,cha:1}}, 'Halfling (Stout)':{fixed:{dex:2,con:1}},
    'Human':{fixed:{str:1,dex:1,con:1,int:1,wis:1,cha:1}}, 'Human (Variant)':{pick:[1,1]},
    'Tiefling':{fixed:{int:1,cha:2}}, 'Wood Elf':{fixed:{dex:2,wis:1}}, 'Custom Lineage':{pick:[2]},
  };
  // Skills a species hands you: fixed list and/or a number of free picks
  WZ.RACE_SKILLS = {
    'Astral Elf':{fixed:['Perception']}, 'Dark Elf (Drow)':{fixed:['Perception']}, 'Elf (High)':{fixed:['Perception']},
    'Wood Elf':{fixed:['Perception']}, 'Half-Orc':{fixed:['Intimidation']}, 'Half-Elf':{pick:2}, 'Human (Variant)':{pick:1},
  };
  WZ.RACE_SPEED = { 'Dwarf (Hill)':25,'Dwarf (Mountain)':25,'Gnome (Forest)':25,'Gnome (Rock)':25,'Halfling (Lightfoot)':25,'Halfling (Stout)':25,'Wood Elf':35 };

  // ---------- Subclasses ----------
  // When the player must choose (2014 rules). 2024 rules: everyone chooses at level 3.
  WZ.SUBCLASS_LEVEL_2014 = { Cleric:1, Sorcerer:1, Warlock:1, Druid:2, Wizard:2 };
  WZ.subclassLevel = (cls, ruleset) => ruleset === '2024' ? 3 : (WZ.SUBCLASS_LEVEL_2014[cls] || 3);

  // 2024 core subclass names (the live SRD only carries one per class).
  WZ.SUBCLASSES_2024 = {
    Barbarian:['Path of the Berserker','Path of the Wild Heart','Path of the World Tree','Path of the Zealot'],
    Bard:['College of Dance','College of Glamour','College of Lore','College of Valor'],
    Cleric:['Life Domain','Light Domain','Trickery Domain','War Domain'],
    Druid:['Circle of the Land','Circle of the Moon','Circle of the Sea','Circle of the Stars'],
    Fighter:['Battle Master','Champion','Eldritch Knight','Psi Warrior'],
    Monk:['Warrior of Mercy','Warrior of Shadow','Warrior of the Elements','Warrior of the Open Hand'],
    Paladin:['Oath of Devotion','Oath of Glory','Oath of the Ancients','Oath of Vengeance'],
    Ranger:['Beast Master','Fey Wanderer','Gloom Stalker','Hunter'],
    Rogue:['Arcane Trickster','Assassin','Soulknife','Thief'],
    Sorcerer:['Aberrant Sorcery','Clockwork Sorcery','Draconic Sorcery','Wild Magic Sorcery'],
    Warlock:['Archfey Patron','Celestial Patron','Fiend Patron','Great Old One Patron'],
    Wizard:['Abjurer','Diviner','Evoker','Illusionist'],
    Artificer:['Alchemist','Armorer','Artillerist','Battle Smith'],
  };

  // One-line summaries. Looked up by "name contains key" (lowercase) so 2014 and 2024 names share them.
  WZ.SUB_BLURB = {
    'berserker':'Frenzied extra attacks while raging.', 'totem warrior':'Gain an animal spirit\'s strengths.', 'wild heart':'Animal spirits grant you perks while raging.',
    'world tree':'Rage-powered boosts to protect and reposition allies.', 'zealot':'Divine fury, hard to kill.', 'ancestral guardian':'Spirits shield your friends and punish enemies.',
    'storm herald':'Raging storm aura around you.', 'path of the beast':'Grow claws, bite or a tail while raging.', 'wild magic':'Raw magic bursts when you rage.',
    'lore':'Extra skills and clever magic to disrupt enemies.', 'valor':'Fight in medium armor and inspire allies in battle.', 'glamour':'Enchanting magic and dazzling presence.',
    'swords':'Flashy blade tricks.', 'whispers':'Secrets, fear and psychic knives.', 'creation':'Conjure objects and animate things.', 'eloquence':'Silver-tongued persuasion that rarely fails.',
    'spirits':'Spirit tales with random helpful effects.', 'dance':'Agile, graceful defense and group movement.',
    'knowledge domain':'Learn languages and skills; read minds.', 'life domain':'The best healer — heals more and sturdier armor.', 'light domain':'Burn foes with radiant fire and flares.',
    'nature domain':'Command plants and animals; heavy armor.', 'tempest domain':'Storm magic — thunder and lightning.', 'trickery domain':'Illusions, stealth and blessings for sneaking.',
    'war domain':'Fight like a battle-priest, extra attacks.', 'arcana domain':'Spells from the wizard list.', 'death domain':'Necrotic power for darker campaigns.',
    'forge domain':'Armored crafter, resistant to fire.', 'grave domain':'Guard the line between life and death.', 'order domain':'Command others to act and boost allies.',
    'peace domain':'Link allies together and share protection.', 'twilight domain':'Calm and shield allies in the dark.',
    'circle of the land':'Extra spells tied to the terrain you choose.', 'circle of the moon':'Turn into tougher beasts in combat.', 'dreams':'Healing and fey magic.',
    'shepherd':'Summon spirits to aid your allies.', 'spores':'Fungal magic and zombies.', 'circle of the stars':'Star charts grant bonuses and healing.',
    'wildfire':'Flame spirit companion heals and burns.', 'circle of the sea':'Water magic and a stormy aura.',
    'battle master':'Special maneuvers — trip, disarm, command.', 'champion':'Simple and tough: bigger critical hits, better athletics.',
    'eldritch knight':'Fighter who also casts wizard spells.', 'arcane archer':'Magical trick arrows.', 'cavalier':'Mounted defender who guards allies.',
    'samurai':'Fierce focus and strong willpower.', 'psi warrior':'Psionic energy to hit, shield and move.', 'rune knight':'Giant-sized strength with magic runes.',
    'open hand':'Push, trip and stun foes with unarmed strikes.', 'way of shadow':'Stealth and teleporting through darkness.', 'four elements':'Cast elemental spells with ki.',
    'drunken master':'Unpredictable, slippery movement.', 'kensei':'Master of weapons and calligraphy.', 'sun soul':'Shoot radiant bolts.',
    'mercy':'Heal friends and harm enemies with touch.', 'astral self':'Summon spectral arms and a mask.', 'elements':'Cast elemental spells with ki.',
    'devotion':'Classic shining knight with holy defenses.', 'ancients':'Nature-and-light guardian with strong magic resistance.', 'vengeance':'Hunt down one foe relentlessly.',
    'conquest':'Intimidating battle commander.', 'redemption':'Peacemaker who tries to avoid violence.', 'glory':'Athletic hero inspiring allies.',
    'watchers':'Guards against otherworldly threats.', 'oathbreaker':'Dark paladin (DM approval).',
    'hunter':'Adapt your fighting to the enemy in front of you.', 'beast master':'Fight alongside an animal companion.', 'gloom stalker':'Ambush predator from the dark.',
    'horizon walker':'Planar hopping hunter.', 'monster slayer':'Specialist against supernatural foes.', 'fey wanderer':'Charming fey magic and extra social skill.',
    'swarmkeeper':'A swarm of spirits that pushes and harries foes.',
    'thief':'Fast hands and climbing — classic burglar.', 'assassin':'Devastating first strikes and disguises.', 'arcane trickster':'Rogue with illusion and trick spells.',
    'inquisitive':'Spot lies and clues.', 'mastermind':'Help allies from afar with clever tactics.', 'scout':'Wilderness skirmisher.', 'swashbuckler':'Flashy duelist with great charm.',
    'phantom':'Haunted rogue with ghostly gifts.', 'soulknife':'Create psychic blades.',
    'draconic':'Dragon ancestry — extra toughness and elemental power.', 'draconic sorcery':'Dragon ancestry — extra toughness and elemental power.',
    'divine soul':'Sorcerer with cleric spells.', 'shadow magic':'Shadow powers and a hound.', 'storm sorcery':'Wind and lightning flair.',
    'aberrant':'Psychic powers and strange tentacle magic.', 'clockwork':'Orderly magic that evens out the odds.',
    'archfey':'Fey patron — charm and tricky escapes.', 'fiend':'Fiendish patron — fire, extra HP on kills.', 'great old one':'Eldritch patron — mind powers.',
    'hexblade':'Magic weapon and cursed armor.', 'celestial':'Radiant healing patron.', 'undying':'Hard to kill.', 'fathomless':'Ocean tentacles and cold.', 'genie':'Bound genie\'s power.',
    'abjur':'Protective warding that absorbs damage.', 'conjur':'Summon creatures and objects.', 'divin':'Foresee the future — swap dice rolls.',
    'enchant':'Charm and control minds.', 'evoc':'Blast spells that spare your friends.', 'illus':'Create convincing illusions.',
    'necrom':'Drain life and raise undead.', 'transmut':'Change matter, make potions.', 'bladesing':'Elf spell-blade fighter.',
    'war magic':'Defensive, battle-ready caster.', 'chronurgy':'Time magic.', 'graviturgy':'Gravity magic.', 'order of scribes':'Living spellbook with swappable spell types.',
    'alchemist':'Potions that heal and harm.', 'armorer':'Powered suit of armor.', 'artillerist':'Magical cannon that blasts or shields.', 'battle smith':'Steel defender companion.',
  };
  WZ.subBlurb = (name) => {
    const n = String(name || '').toLowerCase();
    const hit = Object.keys(WZ.SUB_BLURB).find(k => n.includes(k));
    return hit ? WZ.SUB_BLURB[hit] : '';
  };

  // ---------- Starting gear packages (2 per class) ----------
  // ac: how armor class is figured. kind: barb | monk | none | leather | studded | hide | scale | chain  (+ shield:true)
  const PACK = {
    explorer:'Explorer\'s pack', dungeon:'Dungeoneer\'s pack', priest:'Priest\'s pack', scholar:'Scholar\'s pack',
    burglar:'Burglar\'s pack', diplomat:'Diplomat\'s pack', entertainer:'Entertainer\'s pack',
  };
  WZ.GEAR = {
    Barbarian:[
      { label:'Great axe build', items:['Greataxe','Handaxe ×2','Javelin ×4',PACK.explorer], ac:{kind:'barb'} },
      { label:'Axe and shield', items:['Battleaxe','Shield','Handaxe ×2','Javelin ×4',PACK.explorer], ac:{kind:'barb',shield:true} } ],
    Bard:[
      { label:'Rapier duelist', items:['Rapier','Dagger','Leather armor','Lute',PACK.diplomat], ac:{kind:'leather'} },
      { label:'Longsword performer', items:['Longsword','Dagger','Leather armor','Lute',PACK.entertainer], ac:{kind:'leather'} } ],
    Cleric:[
      { label:'Scale mail and shield', items:['Mace','Scale mail','Shield','Light crossbow','Crossbow bolts ×20','Holy symbol',PACK.priest], ac:{kind:'scale',shield:true} },
      { label:'Lighter armor', items:['Mace','Leather armor','Shield','Light crossbow','Crossbow bolts ×20','Holy symbol',PACK.priest], ac:{kind:'leather',shield:true} } ],
    Druid:[
      { label:'Scimitar', items:['Wooden shield','Scimitar','Leather armor','Druidic focus',PACK.explorer], ac:{kind:'leather',shield:true} },
      { label:'Quarterstaff', items:['Wooden shield','Quarterstaff','Leather armor','Druidic focus',PACK.explorer], ac:{kind:'leather',shield:true} } ],
    Fighter:[
      { label:'Chain mail, sword and shield', items:['Chain mail','Longsword','Shield','Light crossbow','Crossbow bolts ×20',PACK.dungeon], ac:{kind:'chain',shield:true} },
      { label:'Archer', items:['Leather armor','Longbow','Arrows ×20','Shortsword','Handaxe ×2',PACK.explorer], ac:{kind:'leather'} } ],
    Monk:[
      { label:'Shortsword', items:['Shortsword','Darts ×10',PACK.dungeon], ac:{kind:'monk'} },
      { label:'Quarterstaff', items:['Quarterstaff','Darts ×10',PACK.explorer], ac:{kind:'monk'} } ],
    Paladin:[
      { label:'Sword and shield', items:['Longsword','Shield','Javelin ×5','Chain mail','Holy symbol',PACK.priest], ac:{kind:'chain',shield:true} },
      { label:'Two-handed', items:['Greatsword','Javelin ×5','Chain mail','Holy symbol',PACK.explorer], ac:{kind:'chain'} } ],
    Ranger:[
      { label:'Scale mail', items:['Scale mail','Shortsword ×2','Longbow','Arrows ×20',PACK.dungeon], ac:{kind:'scale'} },
      { label:'Leather armor', items:['Leather armor','Shortsword ×2','Longbow','Arrows ×20',PACK.explorer], ac:{kind:'leather'} } ],
    Rogue:[
      { label:'Rapier', items:['Rapier','Shortbow','Arrows ×20','Leather armor','Dagger ×2','Thieves\' tools',PACK.burglar], ac:{kind:'leather'} },
      { label:'Shortsword', items:['Shortsword','Shortbow','Arrows ×20','Leather armor','Dagger ×2','Thieves\' tools',PACK.burglar], ac:{kind:'leather'} } ],
    Sorcerer:[
      { label:'Crossbow', items:['Light crossbow','Crossbow bolts ×20','Component pouch','Dagger ×2',PACK.dungeon], ac:{kind:'none'} },
      { label:'Arcane focus', items:['Quarterstaff','Arcane focus (crystal)','Dagger ×2',PACK.explorer], ac:{kind:'none'} } ],
    Warlock:[
      { label:'Crossbow', items:['Light crossbow','Crossbow bolts ×20','Arcane focus (orb)','Leather armor','Quarterstaff','Dagger ×2',PACK.scholar], ac:{kind:'leather'} },
      { label:'Component pouch', items:['Component pouch','Leather armor','Handaxe','Dagger ×2',PACK.dungeon], ac:{kind:'leather'} } ],
    Wizard:[
      { label:'Quarterstaff', items:['Quarterstaff','Arcane focus (crystal)','Spellbook',PACK.scholar], ac:{kind:'none'} },
      { label:'Dagger and pouch', items:['Dagger','Component pouch','Spellbook',PACK.explorer], ac:{kind:'none'} } ],
    Artificer:[
      { label:'Studded leather', items:['Light crossbow','Crossbow bolts ×20','Dagger ×2','Studded leather armor','Thieves\' tools',PACK.dungeon], ac:{kind:'studded'} },
      { label:'Scale mail', items:['Light crossbow','Crossbow bolts ×20','Dagger ×2','Scale mail','Thieves\' tools',PACK.dungeon], ac:{kind:'scale'} } ],
  };
  WZ.armorClass = function(ac, dexMod, conMod, wisMod){
    const k = (ac && ac.kind) || 'none';
    let v = 10 + dexMod;
    if(k === 'barb') v = 10 + dexMod + conMod;
    else if(k === 'monk') v = 10 + dexMod + wisMod;
    else if(k === 'leather') v = 11 + dexMod;
    else if(k === 'studded') v = 12 + dexMod;
    else if(k === 'hide') v = 12 + Math.min(2, dexMod);
    else if(k === 'scale') v = 14 + Math.min(2, dexMod);
    else if(k === 'chain') v = 16;
    if(ac && ac.shield) v += 2;
    return v;
  };

  // ---------- Spells: name -> [level, plain-language summary] ----------
  const S = WZ.SPELLS = {
    // cantrips
    'Acid Splash':[0,'Hurl acid at one or two nearby foes.'], 'Blade Ward':[0,'Resist weapon damage for a round.'], 'Chill Touch':[0,'Ghostly hand deals necrotic damage and stops healing.'],
    'Dancing Lights':[0,'Create floating lights.'], 'Druidcraft':[0,'Tiny nature effects: predict weather, bloom a flower.'], 'Eldritch Blast':[0,'Your signature ranged beam of force. Gets more beams as you level.'],
    'Fire Bolt':[0,'Ranged fire attack — reliable damage.'], 'Friends':[0,'Briefly charm someone (they know afterward).'], 'Guidance':[0,'Touch: an ally adds a d4 to one ability check.'],
    'Light':[0,'Make an object glow.'], 'Mage Hand':[0,'A floating hand moves small objects.'], 'Mending':[0,'Repair a small break or tear.'], 'Message':[0,'Whisper to a creature far away.'],
    'Minor Illusion':[0,'Create a small sound or image.'], 'Poison Spray':[0,'Short-range poison damage.'], 'Prestidigitation':[0,'Handy tricks: clean, warm, flavor, small illusions.'],
    'Produce Flame':[0,'Hold a flame as light, or throw it.'], 'Ray of Frost':[0,'Ranged cold damage that slows the target.'], 'Resistance':[0,'Touch: an ally adds a d4 to one saving throw.'],
    'Sacred Flame':[0,'Radiant flame the target can try to dodge (ignores armor).'], 'Shillelagh':[0,'Your club or staff hits with Wisdom and bonus damage.'],
    'Shocking Grasp':[0,'Touch for lightning damage; stops the target reacting.'], 'Spare the Dying':[0,'Stabilize a dying creature.'], 'Thaumaturgy':[0,'Minor divine wonders: booming voice, flickering flames.'],
    'Thorn Whip':[0,'Thorny whip that pulls a foe closer.'], 'True Strike':[0,'Study a foe to get an edge on your next attack.'], 'Vicious Mockery':[0,'Insult a creature to hurt its pride and its next attack.'],
    // level 1
    'Absorb Elements':[1,'Reaction: halve elemental damage and add it to your next hit.'], 'Alarm':[1,'Set a silent or loud alert on an area.'], 'Animal Friendship':[1,'Calm a beast.'],
    'Armor of Agathys':[1,'Cold-covered temporary HP that bites back.'], 'Arms of Hadar':[1,'Tentacles burst out and hurt nearby foes.'], 'Bane':[1,'Enemies subtract a d4 from attacks and saves.'],
    'Bless':[1,'Up to three allies add a d4 to attacks and saves.'], 'Burning Hands':[1,'Cone of fire from your fingertips.'], 'Catapult':[1,'Launch an object at a foe.'],
    'Charm Person':[1,'Make someone treat you as a friend for a while.'], 'Chromatic Orb':[1,'Hurl an orb of your choice of damage type.'], 'Color Spray':[1,'Blind weaker creatures with flashing colors.'],
    'Command':[1,'Order a one-word command like Drop or Flee.'], 'Comprehend Languages':[1,'Understand any spoken or written language.'], 'Create or Destroy Water':[1,'Make or remove water.'],
    'Cure Wounds':[1,'Touch to heal.'], 'Detect Evil and Good':[1,'Sense celestials, fiends, undead and the like.'], 'Detect Magic':[1,'See magic nearby.'], 'Detect Poison and Disease':[1,'Sense poisons and diseases.'],
    'Disguise Self':[1,'Change how you look for an hour.'], 'Dissonant Whispers':[1,'Painful psychic whisper that makes the target run.'], 'Divine Favor':[1,'Your weapon deals extra radiant damage.'],
    'Ensnaring Strike':[1,'Your next hit entangles the target in vines.'], 'Entangle':[1,'Grasping plants hold creatures in place.'], 'Expeditious Retreat':[1,'Dash as a bonus action.'],
    'Faerie Fire':[1,'Outline creatures in light so they are easier to hit.'], 'False Life':[1,'Give yourself temporary HP.'], 'Feather Fall':[1,'Slow a fall.'], 'Find Familiar':[1,'Gain a little spirit animal helper.'],
    'Fog Cloud':[1,'Create a thick fog.'], 'Goodberry':[1,'Berries that heal and feed.'], 'Grease':[1,'Slick the ground so creatures fall.'], 'Guiding Bolt':[1,'Radiant ranged blast; the next hit on the target is easier.'],
    'Hail of Thorns':[1,'Your next arrow hit explodes in thorns.'], 'Healing Word':[1,'Heal an ally from a distance with a bonus action.'], 'Hellish Rebuke':[1,'Reaction: burn whoever just hurt you.'],
    'Heroism':[1,'An ally can\'t be frightened and gains temp HP each turn.'], 'Hex':[1,'Curse a target: extra damage and weaker checks on one ability.'], 'Hunter\'s Mark':[1,'Mark prey: extra damage and easy tracking.'],
    'Identify':[1,'Learn what a magic item does.'], 'Inflict Wounds':[1,'Touch for heavy necrotic damage.'], 'Jump':[1,'Triple a creature\'s jump distance.'], 'Longstrider':[1,'Increase an ally\'s speed.'],
    'Mage Armor':[1,'Give yourself better AC without armor.'], 'Magic Missile':[1,'Never misses — three glowing darts of force.'], 'Protection from Evil and Good':[1,'Shield a creature from certain monsters\' attacks.'],
    'Purify Food and Drink':[1,'Remove poison and rot from food and drink.'], 'Ray of Sickness':[1,'Poison ray that can sicken.'], 'Sanctuary':[1,'Enemies must pass a save to attack the warded creature.'],
    'Searing Smite':[1,'Your next hit burns and keeps burning.'], 'Shield':[1,'Reaction: +5 AC until your next turn, and blocks Magic Missile.'], 'Shield of Faith':[1,'+2 AC for an ally.'],
    'Silent Image':[1,'Create an illusion of an image.'], 'Sleep':[1,'Put weaker creatures to sleep — great at low levels.'], 'Snare':[1,'Hidden magical trap.'], 'Speak with Animals':[1,'Talk to beasts.'],
    'Tasha\'s Hideous Laughter':[1,'Target falls prone, laughing, and loses its turn.'], 'Thunderous Smite':[1,'Your next hit booms and can knock foes down.'], 'Thunderwave':[1,'Blast of thunder pushes nearby creatures away.'],
    'Unseen Servant':[1,'An invisible helper does simple chores.'], 'Witch Bolt':[1,'Lightning tether deals damage each turn.'], 'Wrathful Smite':[1,'Your next hit frightens the target.'], 'Compelled Duel':[1,'Force a creature to fight you.'],
    'Zephyr Strike':[1,'Wind speed and a bonus to one attack.'],
  };
  // Starter lists (names must exist in SPELLS) + "rec" = good first picks
  WZ.SPELL_LISTS = {
    Bard:{ cantrips:['Vicious Mockery','Minor Illusion','Mage Hand','Prestidigitation','Light','Message','Dancing Lights','Friends','True Strike','Blade Ward'],
           rec:['Vicious Mockery','Minor Illusion'],
           l1:['Healing Word','Dissonant Whispers','Faerie Fire','Thunderwave','Sleep','Charm Person','Cure Wounds','Heroism','Bane','Tasha\'s Hideous Laughter','Disguise Self','Detect Magic','Comprehend Languages','Feather Fall'],
           recL1:['Healing Word','Dissonant Whispers','Faerie Fire','Thunderwave'] },
    Cleric:{ cantrips:['Sacred Flame','Guidance','Spare the Dying','Light','Thaumaturgy','Resistance','Mending'], rec:['Sacred Flame','Guidance','Spare the Dying'],
             l1:['Cure Wounds','Healing Word','Bless','Guiding Bolt','Shield of Faith','Sanctuary','Command','Bane','Detect Magic','Inflict Wounds','Protection from Evil and Good','Purify Food and Drink','Create or Destroy Water','Detect Evil and Good','Detect Poison and Disease'],
             recL1:['Cure Wounds','Bless','Guiding Bolt','Healing Word','Shield of Faith'] },
    Druid:{ cantrips:['Druidcraft','Shillelagh','Produce Flame','Guidance','Thorn Whip','Poison Spray','Resistance','Mending'], rec:['Druidcraft','Shillelagh'],
            l1:['Entangle','Cure Wounds','Healing Word','Goodberry','Thunderwave','Fog Cloud','Faerie Fire','Speak with Animals','Animal Friendship','Detect Magic','Longstrider','Jump','Purify Food and Drink','Create or Destroy Water','Detect Poison and Disease'],
            recL1:['Entangle','Cure Wounds','Goodberry','Thunderwave','Healing Word'] },
    Sorcerer:{ cantrips:['Fire Bolt','Ray of Frost','Shocking Grasp','Mage Hand','Minor Illusion','Prestidigitation','Light','Message','Mending','Poison Spray','Acid Splash','Chill Touch','Dancing Lights','True Strike','Blade Ward','Friends'],
               rec:['Fire Bolt','Mage Hand','Minor Illusion','Ray of Frost'],
               l1:['Magic Missile','Shield','Burning Hands','Sleep','Charm Person','Chromatic Orb','Thunderwave','Mage Armor','Color Spray','Disguise Self','Expeditious Retreat','False Life','Feather Fall','Fog Cloud','Jump','Witch Bolt','Comprehend Languages','Detect Magic','Ray of Sickness'],
               recL1:['Magic Missile','Shield','Sleep','Burning Hands'] },
    Warlock:{ cantrips:['Eldritch Blast','Minor Illusion','Mage Hand','Prestidigitation','Chill Touch','Poison Spray','Friends','True Strike','Blade Ward'], rec:['Eldritch Blast','Minor Illusion'],
              l1:['Hex','Armor of Agathys','Hellish Rebuke','Charm Person','Protection from Evil and Good','Unseen Servant','Arms of Hadar','Comprehend Languages','Expeditious Retreat','Witch Bolt'],
              recL1:['Hex','Armor of Agathys','Hellish Rebuke'] },
    Wizard:{ cantrips:['Fire Bolt','Mage Hand','Minor Illusion','Prestidigitation','Light','Ray of Frost','Shocking Grasp','Acid Splash','Chill Touch','Dancing Lights','Message','Mending','Poison Spray','True Strike','Friends','Blade Ward'],
             rec:['Fire Bolt','Mage Hand','Minor Illusion'],
             l1:['Magic Missile','Shield','Mage Armor','Sleep','Detect Magic','Find Familiar','Burning Hands','Thunderwave','Charm Person','Feather Fall','Identify','Comprehend Languages','Color Spray','Disguise Self','Fog Cloud','Grease','Jump','Longstrider','Silent Image','Tasha\'s Hideous Laughter','Unseen Servant','Witch Bolt','Chromatic Orb','Alarm','Expeditious Retreat','False Life','Ray of Sickness'],
             recL1:['Magic Missile','Shield','Mage Armor','Sleep','Detect Magic','Find Familiar','Burning Hands','Thunderwave'] },
    Artificer:{ cantrips:['Guidance','Mending','Mage Hand','Light','Fire Bolt','Ray of Frost','Shocking Grasp','Acid Splash','Poison Spray','Prestidigitation','Message','Resistance','Spare the Dying','Thorn Whip','Dancing Lights'],
                rec:['Guidance','Mending'],
                l1:['Cure Wounds','Faerie Fire','Detect Magic','Absorb Elements','Alarm','Catapult','Disguise Self','Expeditious Retreat','False Life','Feather Fall','Grease','Identify','Jump','Longstrider','Purify Food and Drink','Sanctuary','Snare'],
                recL1:['Cure Wounds','Faerie Fire','Detect Magic','Absorb Elements'] },
    Paladin:{ cantrips:[], rec:[],
              l1:['Bless','Cure Wounds','Shield of Faith','Command','Divine Favor','Heroism','Detect Evil and Good','Protection from Evil and Good','Purify Food and Drink','Compelled Duel','Searing Smite','Thunderous Smite','Wrathful Smite'],
              recL1:['Bless','Cure Wounds','Shield of Faith','Divine Favor'] },
    Ranger:{ cantrips:[], rec:[],
             l1:['Hunter\'s Mark','Cure Wounds','Goodberry','Fog Cloud','Longstrider','Speak with Animals','Animal Friendship','Alarm','Detect Magic','Detect Poison and Disease','Jump','Ensnaring Strike','Hail of Thorns','Zephyr Strike'],
             recL1:['Hunter\'s Mark','Cure Wounds','Goodberry','Fog Cloud'] },
  };

  // How each caster handles "how many can I have?"
  //   known    — fixed list (Bard, Sorcerer, Warlock, Ranger): DND.SPELLS_KNOWN
  //   book     — Wizard: spellbook of 6 (+2 per level) , then prepares Int mod + level
  //   prepared — Cleric, Druid: choose Wis mod + level each day from the whole list
  //   halfprep — Paladin, Artificer: prepare mod + half level (min 1)
  WZ.CASTER_STYLE = { Bard:'known', Sorcerer:'known', Warlock:'known', Ranger:'known', Wizard:'book', Cleric:'prepared', Druid:'prepared', Paladin:'halfprep', Artificer:'halfprep' };
  WZ.firstSpellLevel = { Paladin:2, Ranger:2 };

  // ---------- Equipment shop ----------
  // Starting gold if a player buys their own gear instead of taking a package (editable in the UI — ask your DM).
  WZ.START_GOLD = { Barbarian:50, Bard:125, Cleric:125, Druid:50, Fighter:125, Monk:12, Paladin:125, Ranger:125, Rogue:100, Sorcerer:75, Warlock:100, Wizard:100, Artificer:125 };

  // Armor AC math by name (lowercase, matched by "contains"). dex: 'full' | 'max2' | 'none'
  WZ.ARMOR = [
    ['padded',{base:11,dex:'full'}], ['studded leather',{base:12,dex:'full'}], ['leather',{base:11,dex:'full'}],
    ['hide',{base:12,dex:'max2'}], ['chain shirt',{base:13,dex:'max2'}], ['scale mail',{base:14,dex:'max2'}],
    ['breastplate',{base:14,dex:'max2'}], ['half plate',{base:15,dex:'max2'}],
    ['ring mail',{base:14,dex:'none'}], ['chain mail',{base:16,dex:'none'}], ['splint',{base:17,dex:'none'}], ['plate',{base:18,dex:'none'}],
  ];
  WZ.armorFor = name => { const n = String(name).toLowerCase(); const h = WZ.ARMOR.find(a => n.includes(a[0])); return h ? h[1] : null; };
  WZ.isShield = name => /\bshield\b/i.test(name) && !/(spell|cursed|animated)/i.test(name);
  // AC for a list of item names (best armor + shield; falls back to unarmored defense)
  WZ.acFromItems = function(names, dexMod, conMod, wisMod, cls){
    let best = null, shield = false;
    names.forEach(n => {
      if(WZ.isShield(n)) shield = true;
      else { const a = WZ.armorFor(n); if(a){ const v = a.base + (a.dex === 'full' ? dexMod : a.dex === 'max2' ? Math.min(2, dexMod) : 0); if(!best || v > best) best = v; } }
    });
    let v = best;
    if(v == null){ v = 10 + dexMod; if(cls === 'Barbarian') v += conMod; else if(cls === 'Monk') v += wisMod; }
    return v + (shield ? 2 : 0);
  };

  // Parse a price in whatever form Open5e gives ("15 gp", "15.00", 15, {amount,unit}) into gold pieces. null = unknown.
  WZ.parseGp = function(c){
    if(c == null || c === '') return null;
    if(typeof c === 'number') return c;
    if(typeof c === 'object') return WZ.parseGp((c.amount != null ? c.amount : c.value) + ' ' + (c.unit || c.currency || 'gp'));
    const m = String(c).replace(/,/g, '').match(/^\s*([\d.]+)\s*([a-z]{2})?/i);
    if(!m) return null;
    const v = parseFloat(m[1]); if(isNaN(v)) return null;
    const mult = { pp:10, gp:1, ep:0.5, sp:0.1, cp:0.01 }[(m[2] || 'gp').toLowerCase()] || 1;
    return Math.round(v * mult * 100) / 100;
  };
  WZ.fmtGp = gp => gp == null ? '—' : gp >= 1 ? (Math.round(gp * 100) / 100) + ' gp' : gp >= 0.1 ? Math.round(gp * 10) + ' sp' : Math.round(gp * 100) + ' cp';

  // Offline fallback list (standard prices) used if Open5e can't be reached.
  const W_ = (n, gp) => ({ name:n, cat:'Weapons', gp }), A_ = (n, gp) => ({ name:n, cat:'Armor', gp }), G_ = (n, gp) => ({ name:n, cat:'Gear', gp });
  WZ.SHOP_FALLBACK = [
    W_('Club',0.1), W_('Dagger',2), W_('Greatclub',0.2), W_('Handaxe',5), W_('Javelin',0.5), W_('Light hammer',2), W_('Mace',5), W_('Quarterstaff',0.2),
    W_('Sickle',1), W_('Spear',1), W_('Light crossbow',25), W_('Dart',0.05), W_('Shortbow',25), W_('Sling',0.1),
    W_('Battleaxe',10), W_('Flail',10), W_('Glaive',20), W_('Greataxe',30), W_('Greatsword',50), W_('Halberd',20), W_('Lance',10), W_('Longsword',15),
    W_('Maul',10), W_('Morningstar',15), W_('Pike',5), W_('Rapier',25), W_('Scimitar',25), W_('Shortsword',10), W_('Trident',5), W_('War pick',5),
    W_('Warhammer',15), W_('Whip',2), W_('Hand crossbow',75), W_('Heavy crossbow',50), W_('Longbow',50),
    A_('Padded armor',5), A_('Leather armor',10), A_('Studded leather armor',45), A_('Hide armor',10), A_('Chain shirt',50), A_('Scale mail',50),
    A_('Breastplate',400), A_('Half plate armor',750), A_('Ring mail',30), A_('Chain mail',75), A_('Splint armor',200), A_('Plate armor',1500), A_('Shield',10),
    G_('Arrows (20)',1), G_('Crossbow bolts (20)',1), G_('Backpack',2), G_('Bedroll',1), G_('Blanket',0.5), G_('Candle',0.01), G_('Crowbar',2),
    G_('Rations (1 day)',0.5), G_('Rope, hempen (50 ft)',1), G_('Tinderbox',0.5), G_('Torch',0.01), G_('Waterskin',0.2), G_('Healer\'s kit',5),
    G_('Holy symbol',5), G_('Arcane focus (crystal)',10), G_('Component pouch',25), G_('Spellbook',50), G_('Thieves\' tools',25), G_('Herbalism kit',5),
    G_('Potion of healing',50), G_('Lantern, hooded',5), G_('Oil flask',0.1), G_('Grappling hook',2), G_('Hammer',1), G_('Piton',0.05), G_('Mess kit',0.2),
    G_('Lute',35), G_('Flute',2), G_('Disguise kit',25), G_('Rope, silk (50 ft)',10), G_('Ball bearings (bag of 1,000)',1), G_('Caltrops (bag of 20)',1),
    G_('Explorer\'s pack',10), G_('Dungeoneer\'s pack',12), G_('Priest\'s pack',20), G_('Scholar\'s pack',40), G_('Burglar\'s pack',16), G_('Diplomat\'s pack',39), G_('Entertainer\'s pack',40),
  ];

  // ---------- "Choose N from a list" class features ----------
  // Each set: how many you know at a level, and the options (short plain-language summaries written for this app).
  // min / req are a guide only (soft warnings) — confirm exact prerequisites in your book or with your DM.
  const O = (n, b, min, req) => ({ n, b, min: min || 1, req: req || '' });
  const INV_2014 = [
    O('Agonizing Blast','Eldritch Blast hits harder (add your Cha to its damage).',1,'Eldritch Blast'),
    O('Armor of Shadows','Cast Mage Armor on yourself at will.'),
    O('Ascendant Step','Float upward at will.',9),
    O('Beast Speech','Talk to animals at will.'),
    O('Beguiling Influence','Gain Deception and Persuasion proficiency.'),
    O('Bewitching Whispers','Once per rest, cast Compulsion with a spell slot.',7),
    O('Book of Ancient Secrets','Learn and cast ritual spells from any class.',1,'Pact of the Tome'),
    O('Chains of Carceri','Hold celestials, fiends and elementals in place.',15,'Pact of the Chain'),
    O('Devil\'s Sight','See in darkness, even magical darkness.'),
    O('Dreadful Word','Once per rest, cast Confusion with a spell slot.',7),
    O('Eldritch Sight','Cast Detect Magic at will.'),
    O('Eldritch Spear','Eldritch Blast reaches much farther.',1,'Eldritch Blast'),
    O('Eyes of the Rune Keeper','Read any written language.'),
    O('Fiendish Vigor','Gain temporary hit points at will.'),
    O('Gaze of Two Minds','See through a willing creature\'s eyes.'),
    O('Lifedrinker','Weapon hits drain extra life.',12,'Pact of the Blade'),
    O('Mask of Many Faces','Cast Disguise Self at will.'),
    O('Master of Myriad Forms','Cast Alter Self at will.',15),
    O('Minions of Chaos','Once per rest, summon an elemental.',9),
    O('Mire the Mind','Once per rest, cast Slow with a spell slot.',5),
    O('Misty Visions','Cast Silent Image at will.'),
    O('One with Shadows','Turn invisible while standing in dim light or darkness.',5),
    O('Otherworldly Leap','Cast Jump at will.',9),
    O('Repelling Blast','Eldritch Blast pushes targets away.',1,'Eldritch Blast'),
    O('Sculptor of Flesh','Once per rest, cast Polymorph with a spell slot.',7),
    O('Sign of Ill Omen','Once per rest, cast Bestow Curse with a spell slot.',5),
    O('Thief of Five Fates','Once per rest, cast Bane with a spell slot.'),
    O('Thirsting Blade','Attack twice with your pact weapon.',5,'Pact of the Blade'),
    O('Visions of Distant Realms','Cast Arcane Eye at will.',15),
    O('Voice of the Chain Master','Speak and sense through your familiar from afar.',1,'Pact of the Chain'),
    O('Whispers of the Grave','Cast Speak with Dead at will.',9),
    O('Witch Sight','See the true form of shapechangers and illusions.',15),
  ];
  const INV_2024 = [
    O('Agonizing Blast','Eldritch Blast hits harder (add your Cha to its damage).',1,'a Warlock cantrip that deals damage'),
    O('Armor of Shadows','Cast Mage Armor on yourself at will.'),
    O('Ascendant Step','Float upward at will.',5),
    O('Devil\'s Sight','See in darkness, even magical darkness.'),
    O('Devouring Blade','A stronger version of Thirsting Blade — extra attacks with your pact weapon.',12,'Thirsting Blade'),
    O('Eldritch Mind','Better focus on your concentration spells.'),
    O('Eldritch Smite','Spend a spell slot on a weapon hit for extra force damage.',5,'Pact of the Blade'),
    O('Fiendish Vigor','Gain temporary hit points at will.'),
    O('Gaze of Two Minds','See through a willing creature\'s eyes.'),
    O('Lessons of the First Ones','Gain an extra feat of your choice.'),
    O('Lifedrinker','Weapon hits drain extra life.',9,'Pact of the Blade'),
    O('Mask of Many Faces','Cast Disguise Self at will.'),
    O('Misty Visions','Cast Silent Image at will.'),
    O('Otherworldly Leap','Cast Jump at will.',5),
    O('Pact of the Blade','Conjure or bond with a magic weapon.'),
    O('Pact of the Chain','Gain a special familiar.'),
    O('Pact of the Tome','Gain a book of extra cantrips and rituals.'),
    O('Repelling Blast','Eldritch Blast pushes targets away.',1,'a Warlock cantrip that deals damage'),
    O('Thirsting Blade','Attack twice with your pact weapon.',5,'Pact of the Blade'),
    O('Visions of Distant Realms','Cast Arcane Eye at will.',9),
    O('Whispers of the Grave','Cast Speak with Dead at will.',7),
    O('Witch Sight','See the true form of shapechangers and illusions.',15),
  ];
  const invKnown = (lv, rs) => {
    if(rs === '2024') return lv >= 18 ? 10 : lv >= 15 ? 9 : lv >= 12 ? 8 : lv >= 9 ? 7 : lv >= 7 ? 6 : lv >= 5 ? 5 : lv >= 2 ? 3 : lv >= 1 ? 1 : 0;
    return lv >= 18 ? 8 : lv >= 15 ? 7 : lv >= 12 ? 6 : lv >= 9 ? 5 : lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 2 ? 2 : 0;
  };
  // Add more sets here (Fighting Style, Metamagic, Maneuvers…) — the sheet, wizard and level-up all read this list.
  WZ.CHOICE_SETS = [
    { id:'invocations', cls:'Warlock', label:'Eldritch Invocations', noun:'invocation', known: invKnown,
      options: rs => rs === '2024' ? INV_2024 : INV_2014 },
  ];
  WZ.choiceSetsFor = cls => WZ.CHOICE_SETS.filter(c => c.cls === cls);

  // ---------- More species (other books) — name + one-line summary written for this app ----------
  WZ.SPECIES_EXTRA = {
    'Aasimar':'Touched by a celestial power; heals, shines with radiance, resists necrotic and radiant harm.',
    'Aarakocra':'Bird-people with natural flight and talons.', 'Bugbear':'Long-limbed goblinoid with surprising stealth and reach.',
    'Centaur':'Horse-bodied folk: fast, strong charges and hooves.', 'Changeling':'Shapechanger who can alter their face and voice.',
    'Eladrin':'Fey elves tied to the seasons, with a short teleport.', 'Firbolg':'Gentle forest giants with druid-like magic.',
    'Genasi (Air)':'Elemental-touched: levitate and breathe on the wind.', 'Genasi (Earth)':'Elemental-touched: move through earth and stone.',
    'Genasi (Fire)':'Elemental-touched: resist fire, burn bright.', 'Genasi (Water)':'Elemental-touched: swim, breathe water, resist acid.',
    'Githyanki':'Astral warriors with psionic leaps.', 'Githzerai':'Disciplined monastic mind-warriors.', 'Goblin':'Small and quick, with a knack for slipping away.',
    'Harengon':'Rabbit-folk with big jumps and quick reflexes.', 'Hobgoblin':'Disciplined soldiers who help allies in combat.',
    'Kalashtar':'Humans joined with a dream-spirit; mental defenses.', 'Kenku':'Raven-like mimics and forgers.', 'Kobold':'Small dragon-kin who fight best in packs.',
    'Leonin':'Lion-folk with a mighty roar and claws.', 'Lizardfolk':'Cold-blooded survivalists with natural armor and a bite.',
    'Loxodon':'Elephant-folk with thick hides and calm strength.', 'Minotaur':'Horned brutes who charge and gore.', 'Owlin':'Silent-flying owl-folk with keen night sight.',
    'Satyr':'Fey revelers with magic resistance and a love of music.', 'Shifter':'Part-beast humanoids who briefly unleash bestial traits.',
    'Simic Hybrid':'Engineered grafts of animal traits.', 'Tabaxi':'Quick cat-folk with claws and wanderlust.', 'Tortle':'Turtle-folk with a hard shell and calm.',
    'Triton':'Ocean guardians who breathe water and call sea creatures.', 'Vedalken':'Cool, precise scholars with sharp minds.',
    'Warforged':'Living constructs: tough, tireless and resilient.', 'Yuan-ti Pureblood':'Serpent-touched folk, immune to poison and resistant to magic.',
    'Fairy':'Tiny fey with flight and innate magic (see your table\'s version).',
  };

  window.WZ = WZ;
})();