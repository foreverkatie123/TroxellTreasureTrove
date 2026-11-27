var iFileName = "Astral Elf.js";
RequiredSheetVersion('13.0.3');

SourceList["SPLJMR"] = {
	name : "SpellJammer",
	abbreviation : "spljmr",
	group : "homebrew",
	url : ""
};

RaceList["astral elf"] = {
	regExpSearch : /astralelf/i,
	name : "Astral Elf",
	source : ["SPLJMR", 0],
	plural : "Astral Elves",
	size : 3,
	speed : {
		walk : { spd : 30, enc : 20 }
	},
	languageProfs : ["Common", 1],
	savetxt : {
		text : ["Magic can't put me to sleep"],
		adv_vs : ["charmed"]
	},
	skills : ["Perception"],
	vision : [["Darkvision", 60]],
	age : " mature at roughly the same rate as humans, but do not age further after reaching maturity, and they do not die of old age",
	height : " range from 5 to 6 feet tall (4'9\" + 2d8\")",
	weight : " weigh around 155 lb (110 + 2d8 \xD7 2d4 lb)",
	heightMetric : " range from 1,5 to 1,8 metres tall (145 + 5d8 cm)",
	weightMetric : " weigh around 70 kg (50 + 5d8 \xD7 4d4 / 10 kg)",
	scorestxt : "+2 Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma and +1 to Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma",
	scores : [0, 0, 0, 0, 0, 0],
	trait : "Astral Elf (+2 Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma and +1 to Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma)" + (typePF ? " " : "\n") + "Sunlight Sensitivity: Disadvantage on attack rolls and Wisdom (Perception) checks that rely on sight when I or what I am trying to attack/perceive is in direct sunlight.\nVampire's Bite: I can use my bite attack if a target is charmed/grappled by me, or if it is incapacitated or restrained. If hit, I can choose to gain the damage dealt as temp HP, my Prof Bonus per long rest. Vampiric Gaze: Once per short rest, I can cast charm person using Charisma as my spellcasting ability.",
	spellcastingAbility : 6,
	spellcastingBonus : {
		name : "Elf Magic (level 1)",
		spells : ["sacred flame"],
		selection : ["sacred flame"],
		firstCol : "atwill"
	},
	extraLimitedFeatures : [{
		name : "Vampire's Bite (regain temp hp)",
		usages : "Prof",
		usagescalc : "event.value = How('Proficiency Bonus');",
		recovery : "long rest"
	}, {
		name : "Vampiric Gaze",
		usages : 1,
		recovery : "short rest"
	}],
	spellcastingBonus : {
		name : "Starlight Step",
		spells : ["misty step"],
		selection : ["mistry step"],
		firstCol : '5'
	}
};