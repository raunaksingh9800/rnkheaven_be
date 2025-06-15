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

app.get("/db", (req, res) => {
    res.send(esp32_connected.toString());
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
