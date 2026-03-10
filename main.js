const canvas = document.getElementById("view-space");
const ctx = canvas.getContext("2d");

const orbittracker = document.getElementById("orbittracker");
const ctx2 = orbittracker.getContext("2d");

const statsPanel = document.getElementById("stats-panel");

const bodies = [];
const keys = {};
let activeMenu = null;

let menu_cache = {
    x: "0",
    y: "0",
    z: "300",
    mass: "100",
    vx: "0",
    vy: "0",
    vz: "0"
};

const camera = {
    x: 0,
    y: 0,
    z: -500,
    focalLength: 700
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    orbittracker.width = window.innerWidth;
    orbittracker.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (e) => {
    keys[e.code] = true;

    const isSpace = e.code === "Space" || e.key === " " || e.key === "Spacebar";
    if (isSpace && activeMenu) {
        e.preventDefault();
        activeMenu.fillFromCamera();
    }
}, true);

window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
});

window.addEventListener("mousedown", (e) => {
    bodyStats(e.clientX, e.clientY);
});



class Body {
    constructor(x, y, z, mass, type, vx = 0, vy = 0, vz = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.mass = mass;
        this.targetMass = mass;
        this.type = type;

        this.vx = vx;
        this.vy = vy;
        this.vz = vz;

        this.ax = 0;
        this.ay = 0;
        this.az = 0;

        this.trail = [];
        this.trailTimer = 0;

        this.colors = ["red", "orange", "yellow", "green", "blue", "purple"];
    }

    resetAcceleration() {
        this.ax = 0;
        this.ay = 0;
        this.az = 0;
    }

    applyGravity(other, G, softening) {
        if (other === this) return;

        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dz = other.z - this.z;

        const distSq = dx * dx + dy * dy + dz * dz + softening;
        const dist = Math.sqrt(distSq);
        const accel = (G * other.mass) / distSq;

        this.ax += (dx / dist) * accel;
        this.ay += (dy / dist) * accel;
        this.az += (dz / dist) * accel;
    }

    getCollisionRadius() {
        if (this.type === "Planet") return Math.max(4, Math.cbrt(this.mass) * 0.8);
        if (this.type === "Star") return Math.max(8, Math.cbrt(this.mass) * 1.2);
        if (this.type === "Blackhole") return Math.max(6, Math.cbrt(this.mass));
        if (this.type === "Asteroid") return Math.max(2, Math.cbrt(this.mass) * 0.5);
        return 5;
    }

    collisionLogics(other) {
        if (other === this) return false;

        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dz = other.z - this.z;

        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const thisRadius = this.getCollisionRadius();
        const otherRadius = other.getCollisionRadius();

        if (dist > thisRadius + otherRadius) return false;

        let bigger = this;
        let smaller = other;

        if (other.mass > this.mass) {
            bigger = other;
            smaller = this;
        }

        const totalMass = bigger.mass + smaller.mass;

        bigger.vx = (bigger.vx * bigger.mass + smaller.vx * smaller.mass) / totalMass;
        bigger.vy = (bigger.vy * bigger.mass + smaller.vy * smaller.mass) / totalMass;
        bigger.vz = (bigger.vz * bigger.mass + smaller.vz * smaller.mass) / totalMass;

        bigger.targetMass += smaller.mass;

        return smaller;
    }

    update(dt) {
        this.mass += (this.targetMass - this.mass) * 0.001;
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;
        this.vz += this.az * dt;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;
    }

    updateTrail(dt) {
            this.trailTimer += dt;

            if (this.trailTimer >= 2) {
                this.trail.push({
                    x: this.x,
                    y: this.y,
                    z: this.z
                });

                this.trailTimer = 0;
            }

    }

    drawTrail() {
        if (this.trail.length < 2) return;

        ctx2.beginPath();
        let started = false;

        for (const point of this.trail) {
            const p = projectPoint(point.x, point.y, point.z);
            if (!p) continue;
            if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
                continue;
            }


            if (!started) {
                ctx2.moveTo(p.x, p.y);
                started = true;
            } else {
                ctx2.lineTo(p.x, p.y);
            }
        }

        if (!started) return;

        switch (this.type) {
            case "Planet": ctx2.strokeStyle = "blue"; break;
            case "Star": ctx2.strokeStyle = "yellow"; break;
            case "Blackhole": ctx2.strokeStyle = "red"; break;
            case "Asteroid": ctx2.strokeStyle = "green"; break;
            case "Gas": return; break;
        }

        ctx2.lineWidth = 1;
        ctx2.stroke();
    }

    color() {
        if (this.type === "Planet") return "deepskyblue";
        if (this.type === "Star") return "gold";
        if (this.type === "Blackhole") return "purple";
        if (this.type === "Asteroid") return "lightgray";
        if (this.type === "Gas") return "rgba(180, 220, 255, 0.1)";
        return "white";
    }

    radius() {
        if (this.type === "Planet") return Math.max(4, Math.cbrt(this.mass) * 0.8);
        if (this.type === "Star") return Math.max(8, Math.cbrt(this.mass) * 1.2);
        if (this.type === "Blackhole") return Math.max(6, Math.cbrt(this.mass));
        if (this.type === "Asteroid") return Math.max(2, Math.cbrt(this.mass) * 0.5);
        if (this.type === "Gas") return Math.cbrt(this.mass);
        return 5;
    }

    project() {
        return projectPoint(this.x, this.y, this.z);
    }

    draw() {
        const p = this.project();
        if (!p) return;

        const r = Math.max(1, this.radius() * p.scale);

        if (r <= 0.05) {
            return;
        }

        if (
            p.x + r < 0 ||
            p.x - r > canvas.width ||
            p.y + r < 0 ||
            p.y - r > canvas.height
        ) {
            return;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = this.color();
        ctx.fill();


        if (this.type === "Blackhole") {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = "black";
            ctx.fill();
        }
    }
}

class CoordMenu {
    constructor(type) {
        this.type = type;
        this.el = null;
        this.inputs = {};
    }

    makeInput(labelText, value) {
        const label = document.createElement("label");
        label.textContent = labelText;

        const input = document.createElement("input");
        input.type = "number";
        input.value = value;

        this.el.appendChild(label);
        this.el.appendChild(input);

        return input;
    }

    open() {
        if (activeMenu && activeMenu.el) {
            activeMenu.el.remove();
        }

        if (this.type !== "Gas") {
            this.el = document.createElement("div");
            this.el.className = "coord";

            const title = document.createElement("div");
            title.textContent = `Create ${this.type}`;
            this.el.appendChild(title);

            this.inputs.x = this.makeInput("X", menu_cache.x);
            this.inputs.y = this.makeInput("Y", menu_cache.y);
            this.inputs.z = this.makeInput("Z", menu_cache.z);
            this.inputs.mass = this.makeInput("Mass", menu_cache.mass);
            this.inputs.vx = this.makeInput("Velocity X", menu_cache.vx);
            this.inputs.vy = this.makeInput("Velocity Y", menu_cache.vy);
            this.inputs.vz = this.makeInput("Velocity Z", menu_cache.vz);
            this.inputs.radius = 0;


            const hint = document.createElement("div");
            hint.className = "hint";
            hint.textContent = "Press Space to fill X/Y/Z from camera";
            this.el.appendChild(hint);

            const fillBtn = document.createElement("button");
            fillBtn.textContent = "Fill From Camera";
            fillBtn.addEventListener("click", () => this.fillFromCamera());
            this.el.appendChild(fillBtn);

            const finishBtn = document.createElement("button");
            finishBtn.textContent = "Finish";
            finishBtn.addEventListener("click", () => this.finish());
            this.el.appendChild(finishBtn);

            document.body.appendChild(this.el);
            activeMenu = this;

        } else {
            this.el = document.createElement("div");
            this.el.className = "coord";

            const title = document.createElement("div");
            title.textContent = `Create ${this.type} cloud`;
            this.el.appendChild(title);

            this.inputs.x = this.makeInput("X", menu_cache.x);
            this.inputs.y = this.makeInput("Y", menu_cache.y);
            this.inputs.z = this.makeInput("Z", menu_cache.z);
            this.inputs.mass = this.makeInput("Per particle mass", menu_cache.mass);
            this.inputs.radius = this.makeInput("Gas radius", menu_cache.radius);

            const hint = document.createElement("div");
            hint.className = "hint";
            hint.textContent = "Press Space to fill X/Y/Z from camera";
            this.el.appendChild(hint);

            const fillBtn = document.createElement("button");
            fillBtn.textContent = "Fill From Camera";
            fillBtn.addEventListener("click", () => this.fillFromCamera());
            this.el.appendChild(fillBtn);

            const finishBtn = document.createElement("button");
            finishBtn.textContent = "Finish";
            finishBtn.addEventListener("click", () => this.finish());
            this.el.appendChild(finishBtn);

            document.body.appendChild(this.el);
            activeMenu = this;

        }
    }

    fillFromCamera() {
        const spawnDistance = 1200;

        this.inputs.x.value = String(Math.round(camera.x));
        this.inputs.y.value = String(Math.round(camera.y));
        this.inputs.z.value = String(Math.round(camera.z + spawnDistance));

        menu_cache.x = this.inputs.x.value;
        menu_cache.y = this.inputs.y.value;
        menu_cache.z = this.inputs.z.value;
    }

    finish() {
        const x = Number(this.inputs.x.value);
        const y = Number(this.inputs.y.value);
        const z = Number(this.inputs.z.value);
        const mass = Number(this.inputs.mass.value);
        const radius = Number(this.inputs.radius.value || 0);

        let vx = 0;
        let vy = 0;
        let vz = 0;

        if (this.type !== "Gas") {
            vx = Number(this.inputs.vx.value);
            vy = Number(this.inputs.vy.value);
            vz = Number(this.inputs.vz.value);
        }

        if (
            Number.isNaN(x) ||
            Number.isNaN(y) ||
            Number.isNaN(z) ||
            Number.isNaN(mass) ||
            Number.isNaN(radius) ||
            Number.isNaN(vx) ||
            Number.isNaN(vy) ||
            Number.isNaN(vz)
        ) {
            alert("Put valid numbers in all fields bro 💀");
            return;
        }

        menu_cache.x = this.inputs.x.value;
        menu_cache.y = this.inputs.y.value;
        menu_cache.z = this.inputs.z.value;
        menu_cache.mass = this.inputs.mass.value;
        menu_cache.radius = this.inputs.radius?.value || "0";

        if (this.type !== "Gas") {
            menu_cache.vx = this.inputs.vx.value;
            menu_cache.vy = this.inputs.vy.value;
            menu_cache.vz = this.inputs.vz.value;
        }

        if (this.type === "Gas") {
            for (let i = 0; i < 1000; i++) {
                const dx = (Math.random() - 0.5) * radius;
                const dy = (Math.random() - 0.5) * radius;
                const dz = (Math.random() - 0.5) * radius;

                bodies.push(
                    new Body(
                        x + dx,
                        y + dy,
                        z + dz,
                        mass * 0.000001,
                        "Gas",
                        0,
                        0,
                        0
                    )
                );
            }
        } else {
            bodies.push(new Body(x, y, z, mass, this.type, vx, vy, vz));
        }

        this.el.remove();
        this.el = null;

        if (activeMenu === this) {
            activeMenu = null;
        }
    }
}

function projectPoint(x, y, z) {
    const dx = x - camera.x;
    const dy = y - camera.y;
    const dz = z - camera.z;

    if (dz <= 1) return null;

    const scale = camera.focalLength / dz;

    return {
        x: canvas.width / 2 + dx * scale,
        y: canvas.height / 2 + dy * scale,
        scale
    };
}

let cameraZPush = 0;
function updateCamera(dt) {

    const speed = 8 * dt;

    if (keys["KeyW"]) camera.y -= speed;
    if (keys["KeyS"]) camera.y += speed;
    if (keys["KeyA"]) camera.x -= speed;
    if (keys["KeyD"]) camera.x += speed;
    if (keys["KeyQ"]) camera.z -= speed;
    if (keys["KeyE"]) camera.z += speed;

    camera.z += cameraZPush * dt;
    cameraZPush *= 0.99;

    if (Math.abs(cameraZPush) < 0.01) {
        cameraZPush = 0;
    }
}

function handleCollisions() {
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const eaten = bodies[i].collisionLogics(bodies[j]);

            if (eaten) {
                const index = bodies.indexOf(eaten);
                if (index !== -1) {
                    bodies.splice(index, 1);
                }
                j--;
            }
        }
    }
}

function updatePhysics(dt) {
    const G = 0.08;
    const softening = 100;

    for (const body of bodies) {
        body.ax = 0;
        body.ay = 0;
        body.az = 0;
    }

    for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];

        for (let j = i + 1; j < bodies.length; j++) {
            const b = bodies[j];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dz = b.z - a.z;

            const distSq = dx * dx + dy * dy + dz * dz + softening;
            const dist = Math.sqrt(distSq);

            const dirX = dx / dist;
            const dirY = dy / dist;
            const dirZ = dz / dist;

            const accelA = (G * b.mass) / distSq;
            const accelB = (G * a.mass) / distSq;

            a.ax += dirX * accelA;
            a.ay += dirY * accelA;
            a.az += dirZ * accelA;

            b.ax -= dirX * accelB;
            b.ay -= dirY * accelB;
            b.az -= dirZ * accelB;
        }
    }

    for (const body of bodies) {
        body.update(dt);
        body.updateTrail(dt);
    }
}

function bodyStats(mouseX, mouseY) {
    let clickedBody = null;

    for (let i = bodies.length - 1; i >= 0; i--) {
        const body = bodies[i];
        const p = body.project();
        if (!p) continue;

        const r = Math.max(1, body.radius() * p.scale);

        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (r < 5) {
            if (dist <= r ** 2) {
                clickedBody = body;
                break;
            }
        } else {
            if (dist <= r) {
                clickedBody = body;
                break;
            }
        }

    }

    if (!clickedBody) {
        statsPanel.style.display = "none";
        statsPanel.innerHTML = "";
        return;
    }

    statsPanel.style.display = "block";
    statsPanel.innerHTML = `
        <h3>${clickedBody.type} Stats</h3>
        <p><strong>Mass:</strong> ${clickedBody.mass.toFixed(2)}</p>
        <p><strong>X:</strong> ${clickedBody.x.toFixed(2)}</p>
        <p><strong>Y:</strong> ${clickedBody.y.toFixed(2)}</p>
        <p><strong>Z:</strong> ${clickedBody.z.toFixed(2)}</p>
        <p><strong>VX:</strong> ${clickedBody.vx.toFixed(2)}</p>
        <p><strong>VY:</strong> ${clickedBody.vy.toFixed(2)}</p>
        <p><strong>VZ:</strong> ${clickedBody.vz.toFixed(2)}</p>
        <p><strong>AX:</strong> ${clickedBody.ax.toFixed(2)}</p>
        <p><strong>AY:</strong> ${clickedBody.ay.toFixed(2)}</p>
        <p><strong>AZ:</strong> ${clickedBody.az.toFixed(2)}</p>
    `;
}

function drawBackgroundStars() {
    for (let i = 0; i < 60; i++) {
        const x = (i * 137) % canvas.width;
        const y = (i * 211) % canvas.height;
        ctx.fillStyle = "white";
        ctx.fillRect(x, y, 2, 2);
    }
}

function spawnRandomBodies(count = 50) {
    const RANGE = 50000;
    const types = ["Planet", "Star", "Blackhole", "Asteroid"];

    let spawned = 0;

    while (spawned < count) {
        const x = (Math.random() - 0.5) * RANGE;
        const y = (Math.random() - 0.5) * RANGE;
        const z = camera.z + 200 + RANGE * Math.random();

        const roll = Math.random() * 100;
        let type;
        let mass;

        if (roll < 0.1) {
            type = "Blackhole";
            mass = 1000000 + Math.random() * 20000;
        } else if (roll < 10) {
            type = "Star";
            mass = 2000 + Math.random() * 5000;
        } else if (roll < 15) {
            type = "Planet";
            mass = 50 + Math.random() * 50;
        } else {
            type = "Asteroid";
            mass = 5 + Math.random() * 5;
        }

        bodies.push(new Body(x, y, z, mass, type, 0, 0, 0));
        spawned += 1;
    }
}

function updateCurrentcoord() {
    let locx = document.getElementById("locx");
    let locy = document.getElementById("locy");
    let locz = document.getElementById("locz");

    locx.textContent = `X: ${Math.round(camera.x)}`;
    locy.textContent = `Y: ${Math.round(camera.y)}`;
    locz.textContent = `Z: ${Math.round(camera.z)}`;
}

function updatePrecision() {
    const input = document.getElementById("precision");

    return Number(input.value);
}

document.querySelectorAll(".button").forEach((button) => {
    button.addEventListener("click", () => {
        if (button.dataset.type !== "Randoms") {
            new CoordMenu(button.dataset.type).open();
        } else {
            spawnRandomBodies(50);
        }
    });
});
document.querySelectorAll(".muskbutton").forEach((button) => {
    button.addEventListener("click", () => {
        if (button.dataset.type === "JMPB") {
            cameraZPush -= 10000;
        } else {
            cameraZPush += 10000;
        }
    });
});

let lastTime = performance.now();

let substeps = 5;
function render(now) {
    const dt = Math.min((now - lastTime) / 16.6767, 2);
    lastTime = now;

    const step = dt / substeps;

    for (let i = 0; i < substeps; i++) {
        updateCamera(step);
        updatePhysics(step);
        handleCollisions();
        updateCurrentcoord();
        substeps = updatePrecision();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx2.clearRect(0, 0, orbittracker.width, orbittracker.height);

    //drawBackgroundStars();

    const sorted = [...bodies].sort((a, b) => b.z - a.z);

    for (const body of sorted) {
        body.drawTrail();
    }

    for (const body of sorted) {
        body.draw();
    }

    requestAnimationFrame(render);
}

document.getElementById("precision").value = "5";
requestAnimationFrame(render);