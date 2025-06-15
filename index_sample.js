const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
import { createClient } from "redis";
require("dotenv").config();
const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

const ex = {
  from: "esp32",
  p: "update",
  data: {
    temp: 0,
    humd: 0,
    fan: 0,
    light: 0,
  },
};

client.on("error", (err) => console.log("Redis Client Error", err));

await client.connect();

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    fs.readFile("./index.html", (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end("Error loading HTML");
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  }
});

const wss = new WebSocket.Server({ server });

let esp32 = null;
let fe = null;
//<from><TO><status>-T<int>-T<int>
wss.on("connection", async (ws) => {
  await client.set("shd_fan", "");
  await client.set("shd_light", "");
  await client.set("esp32_status", 0);
  await client.set("temp", "");
  await client.set("humd", "");
  await client.set("fan", "");
  await client.set("light", "");

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log("Received:", data);

      if (data.from == "esp32" && data.p == "status") {
        await client.set("esp32_status", 1);
      }

      if (data.from == "esp32" && data.p == "update") {
        await client.set("temp", data.data["temp"]);
        await client.set("humd", data.data["humd"]);
        await client.set("fan", data.data["fan"]);
        await client.set("light", data.data["light"]);
      }

      if (data.from == "fe" && data.p == "get") {
        let temp = {
          from: "be",
          p: "update",
          data: {
            temp: await client.get("temp"),
            humd: await client.get("humd"),
            fan: await client.get("fan"),
            light: await client.get("light"),
            shd_fan: await client.get("shd_fan"),
            shd_light: await client.get("shd_light"),
            esp32_status: await client.get("esp32_status"),
          },
        };

        ws.send(temp);
      }

      if (
        data.from == "fe"
        &&
        data.p == "update"
      ){
      if(data.data.fan) {
        let temp = {
          from: "be",
          p: "update",
          data: {
            temp: await client.get("temp"),
            humd: await client.get("humd"),
            fan: await client.get("fan"),
            light: await client.get("light"),
            shd_fan: await client.get("shd_fan"),
            shd_light: await client.get("shd_light"),
            esp32_status: await client.get("esp32_status"),
          },
        };
        }
      }
    } catch (e) {
      console.error("Invalid JSON:", msg);
    }
  });
});

server.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});
