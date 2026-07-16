import { Application, Graphics } from "pixi.js";

export class DiceEngine {
    constructor() {
        this.app = null;
        this.stage = null;
        this.dice = [];
    }

    async init() {

        this.app = new Application();

        await this.app.init({
            resizeTo: window,
            backgroundAlpha: 0,
            antialias: true
        });

        this.app.canvas.id = "diceCanvas";

        Object.assign(this.app.canvas.style, {
            position: "fixed",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: "999999"
        });

        document.body.appendChild(this.app.canvas);
        this.stage = this.app.stage;
        this.app.ticker.add(this.update.bind(this));
    }

    update(delta) {
    }
}