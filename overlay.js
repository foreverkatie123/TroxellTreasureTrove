import { DiceEngine } from "./dice/DiceEngine.js";

const diceEngine = new DiceEngine();

await diceEngine.init();

window.diceEngine = diceEngine;