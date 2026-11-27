var iFileName = "Fairy.js";
RequiredSheetVersion('13.0.3');

SourceList["SPLJMR"] = {
	name : "SpellJammer",
	abbreviation : "spljmr",
	group : "homebrew",
	url : ""
};

RaceList["fairy"] = {
	regExpSearch : /fairy/i,
	name : "Fairy",
	source : ["SPLJMR", 0],
	plural : "Fairies",
	size : 2,
	speed : {
		walk : { spd : 30, enc : 20 },
		fly : { spd : 30, enc : 20 }
	},
	languageProfs : ["Common", 1],
	vision : [["Darkvision", 60]],
	age : " mature at roughly the same rate as humans, but do not age further after reaching maturity, and they do not die of old age",
	height : " range from 1 to 3 feet tall (4'9\" + 2d8\")",
	weight : " weigh around 155 lb (110 + 2d8 \xD7 2d4 lb)",
	heightMetric : " range from 1,5 to 1,8 metres tall (145 + 5d8 cm)",
	weightMetric : " weigh around 70 kg (50 + 5d8 \xD7 4d4 / 10 kg)",
	scorestxt : "+2 Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma and +1 to Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma",
	scores : [0, 0, 0, 0, 0, 0],
	trait : "Fairy (+2 Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma and +1 to Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma)" ,
	spellcastingAbility : 4,
	spellcastingBonus : {
		name : "Fairy (level 1)",
		spells : ["Druidcraft"],
		selection : ["druidcraft"],
		firstCol : "atwill"
	},
	spellcastingBonus : {
		name : "Enlarge / Reduce (level 5)",
		spells : ["enlarge/reduce"],
		selection : ["enlarge/reduce"],
		firstCol : "atwill"
	},
	spellcastingBonus : {
		name : "Faire Fire (level 3)",
		spells : ["faire fire"],
		selection : ["fairy fire"],
		firstCol : 'atwill'
	}
};