// ======= backend.js =======
const WebSocket = require("ws");
const cron = require("node-cron");
const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "localhost";
}

let esp32_connected = 0;
let fan_state = 0;
let light_state = 0;

let schedule_fan = 1;
let schedule_light = 1;

let schedule_light_state = 0;
let schedule_fan_state = 0;
let cron_statement_fan = "*/1 * * * *";
let cron_statement_light = "*/1 * * * *";

let current_ws = null;
let fan_cron_started = false;
let light_cron_started = false;

const light_shd = (ws) => {
    light_state = (schedule_light_state);
        console.log(`LIGHT:${(light_state)? "ON" : "OFF"}`)

    if (ws?.readyState === WebSocket.OPEN) ws.send(`LIGHT:${(light_state)? "ON" : "OFF"}`);
};

const fan_shd = (ws) => {
    fan_state = schedule_fan_state;
        console.log(`FAN:${(fan_state)? "ON" : "OFF"}`)
    if (ws?.readyState === WebSocket.OPEN) ws.send(`FAN:${(fan_state)? "ON" : "OFF"}`);
};

const app = express();

app.get("/set_state/:msg", (req, res) => {
    const msg = req.params.msg;
    if (!esp32_connected || !current_ws || current_ws.readyState !== WebSocket.OPEN) {
        return res.status(503).send("ESP32 not connected");
    }

    if (msg === "FAN:ON") fan_state = 1;
    else if (msg === "FAN:OFF") fan_state = 0;
    else if (msg === "LIGHT:ON") light_state = 1;
    else if (msg === "LIGHT:OFF") light_state = 0;
    else return res.status(400).send("Invalid message");

    current_ws.send(msg);
    res.send(`Sent: ${msg}`);
});


// API to set fan schedule state and cron expression
app.post("/set_shd_fan", express.json(), (req, res) => {
    const { shd_state, cron_expression } = req.body;

    if (typeof shd_state !== "number" || (shd_state !== 0 && shd_state !== 1)) {
        return res.status(400).send("Invalid shd_state");
    }
    if (typeof cron_expression !== "string" || !cron.validate(cron_expression)) {
        return res.status(400).send("Invalid cron_expression");
    }

    schedule_fan_state = shd_state;
    cron_statement_fan = cron_expression;

    // Optionally restart the cron job if needed
    // (for simplicity, not stopping previous jobs here)

    res.send({
        message: "Fan schedule updated",
        schedule_fan_state,
        cron_statement_fan
    });
});


app.post("/set_shd_light", express.json(), (req, res) => {
    const { shd_state, cron_expression } = req.body;

    if (typeof shd_state !== "number" || (shd_state !== 0 && shd_state !== 1)) {
        return res.status(400).send("Invalid shd_state");
    }
    if (typeof cron_expression !== "string" || !cron.validate(cron_expression)) {
        return res.status(400).send("Invalid cron_expression");
    }

    schedule_light_state = shd_state;
    cron_statement_light = cron_expression;

    // Optionally restart the cron job if needed
    // (for simplicity, not stopping previous jobs here)

    res.send({
        message: "Fan schedule updated",
        schedule_light_state,
        cron_statement_light
    });
});


app.get("/db", (req, res) => {
    res.json({
        esp32_connected: { value: esp32_connected, description: "Is ESP32 connected (0/1)" },
        fan_state: { value: fan_state, description: "Current fan state (0=OFF, 1=ON)" },
        light_state: { value: light_state, description: "Current light state (0=OFF, 1=ON)" },
        schedule_fan: { value: schedule_fan, description: "Is fan scheduling enabled (0/1)" },
        schedule_light: { value: schedule_light, description: "Is light scheduling enabled (0/1)" },
        schedule_light_state: { value: schedule_light_state, description: "Scheduled state for light (0=OFF, 1=ON)" },
        schedule_fan_state: { value: schedule_fan_state, description: "Scheduled state for fan (0=OFF, 1=ON)" },
        cron_statement_fan: { value: cron_statement_fan, description: "Fan cron schedule expression" },
        cron_statement_light: { value: cron_statement_light, description: "Light cron schedule expression" },
        fan_cron_started: { value: fan_cron_started, description: "Is fan cron job started (true/false)" },
        light_cron_started: { value: light_cron_started, description: "Is light cron job started (true/false)" }
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    current_ws = ws;
    ws.on("message", (msg) => {
        esp32_connected = 1;

        if (schedule_fan && !fan_cron_started) {
            fan_cron_started = true;
            cron.schedule(cron_statement_fan, () => setImmediate(() => fan_shd(ws)));
        }

        if (schedule_light && !light_cron_started) {
            light_cron_started = true;
            cron.schedule(cron_statement_light, () => setImmediate(() => light_shd(ws)));
        }

        if (msg === "FAN:ON") fan_state = 1;
        else if (msg === "FAN:OFF") fan_state = 0;
        else if (msg === "LIGHT:ON") light_state = 1;
        else if (msg === "LIGHT:OFF") light_state = 0;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const ip = getLocalIP();
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Accessible on network: http://${ip}:${PORT}`);
});


// ======= index.html =======
// Save this in the same folder as backend.js

/* index.html */

/*

*/
