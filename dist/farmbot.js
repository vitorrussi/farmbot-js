"use strict";
var mqtt_1 = require("mqtt");
var util_1 = require("./util");
var util_2 = require("./util");
var Farmbot = (function () {
    function Farmbot(input) {
        this._events = {};
        this._state = util_1.assign({}, Farmbot.defaults, input);
        this._decodeThatToken();
    }
    Farmbot.prototype._decodeThatToken = function () {
        var token;
        try {
            var str = this.getState()["token"];
            var base64 = str.split(".")[1];
            var plaintext = atob(base64);
            token = JSON.parse(plaintext);
        }
        catch (e) {
            console.warn(e);
            throw new Error("Unable to parse token. Is it properly formatted?");
        }
        var mqttUrl = token.mqtt || "MQTT SERVER MISSING FROM TOKEN";
        var isSecure = location.protocol === "https:";
        var protocol = isSecure ? "wss://" : "ws://";
        var port = isSecure ? 443 : 3002;
        this.setState("mqttServer", "" + protocol + mqttUrl + ":" + port);
        this.setState("uuid", token.bot || "UUID MISSING FROM TOKEN");
    };
    Farmbot.prototype.getState = function () {
        return JSON.parse(JSON.stringify(this._state));
    };
    ;
    Farmbot.prototype.setState = function (key, val) {
        if (val !== this._state[key]) {
            var old = this._state[key];
            this._state[key] = val;
            this.emit("change", { name: key, value: val, oldValue: old });
        }
        ;
        return val;
    };
    ;
    Farmbot.prototype.powerOff = function () {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "power_off", args: {} }];
        return this.send(p);
    };
    Farmbot.prototype.reboot = function () {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "reboot", args: {} }];
        return this.send(p);
    };
    Farmbot.prototype.checkUpdates = function () {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "check_updates", args: { package: "farmbot_os" } }];
        return this.send(p);
    };
    // TODO: Merge this (legacy) method with #checkUpdates().
    Farmbot.prototype.checkArduinoUpdates = function () {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "check_updates", args: { package: "arduino_firmware" } }];
        return this.send(p);
    };
    /** Lock the bot from moving. This also will pause running regimens and cause
     *  any running sequences to exit
     */
    Farmbot.prototype.emergencyLock = function () {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "emergency_lock", args: {} }];
        return this.send(p);
    };
    /** Unlock the bot when the user says it is safe. */
    Farmbot.prototype.emergencyUnlock = function () {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "emergency_unlock", args: {} }];
        return this.send(p);
    };
    Farmbot.prototype.execSequence = function (sequence_id) {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "execute", args: { sequence_id: sequence_id } }];
        return this.send(p);
    };
    Farmbot.prototype.home = function (args) {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "home", args: args }];
        return this.send(p);
    };
    Farmbot.prototype.moveAbsolute = function (args) {
        var p = util_1.rpcRequest();
        var x = args.x, y = args.y, z = args.z, speed = args.speed;
        speed = speed || 100;
        p.body = [
            {
                kind: "move_absolute",
                args: {
                    location: util_1.coordinate(x, y, z),
                    offset: util_1.coordinate(0, 0, 0),
                    speed: speed
                }
            }
        ];
        return this.send(p);
    };
    Farmbot.prototype.moveRelative = function (args) {
        var p = util_1.rpcRequest();
        var x = args.x, y = args.y, z = args.z, speed = args.speed;
        speed = speed || 100;
        p.body = [{ kind: "move_relative", args: { x: x, y: y, z: z, speed: speed } }];
        return this.send(p);
    };
    Farmbot.prototype.writePin = function (args) {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "write_pin", args: args }];
        return this.send(p);
    };
    Farmbot.prototype.togglePin = function (args) {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "toggle_pin", args: args }];
        return this.send(p);
    };
    Farmbot.prototype.readStatus = function (args) {
        if (args === void 0) { args = {}; }
        var p = util_1.rpcRequest();
        p.body = [{ kind: "read_status", args: args }];
        return this.send(p);
    };
    Farmbot.prototype.sync = function (args) {
        if (args === void 0) { args = {}; }
        var p = util_1.rpcRequest();
        p.body = [{ kind: "sync", args: args }];
        return this.send(p);
    };
    /** Update the arduino settings */
    Farmbot.prototype.updateMcu = function (update) {
        var p = util_1.rpcRequest();
        p.body = [];
        Object
            .keys(update)
            .forEach(function (label) {
            var value = util_2.pick(update, label, "ERROR") || "ERROR!";
            (p.body || []).push({
                kind: "config_update",
                args: { package: "arduino_firmware" },
                body: [
                    {
                        kind: "pair",
                        args: { value: value, label: label }
                    }
                ]
            });
        });
        return this.send(p);
    };
    /** Update a config */
    Farmbot.prototype.updateConfig = function (update) {
        var p = util_1.rpcRequest();
        p.body = [];
        Object
            .keys(update)
            .forEach(function (label) {
            var value = util_2.pick(update, label, "ERROR") || "ERROR!";
            (p.body || []).push({
                kind: "config_update",
                args: { package: "farmbot_os" },
                body: [
                    {
                        kind: "pair",
                        args: { value: value, label: label }
                    }
                ]
            });
        });
        return this.send(p);
    };
    Farmbot.prototype.startRegimen = function (args) {
        var p = util_1.rpcRequest();
        p.body = [
            {
                kind: "start_regimen",
                args: {
                    regimen_id: args.regimen_id,
                    label: util_1.uuid()
                }
            }
        ];
        return this.send(p);
    };
    Farmbot.prototype.stopRegimen = function (args) {
        var p = util_1.rpcRequest();
        p.body = [
            {
                kind: "stop_regimen",
                args: {
                    // HACK: The way start/stop regimen works right now is actually broke.
                    //       We don't want to fix until the JSON RPC upgrade is complete.
                    label: args.regimen_id.toString()
                }
            }
        ];
        return this.send(p);
    };
    Farmbot.prototype.calibrate = function (args) {
        var p = util_1.rpcRequest();
        p.body = [{ kind: "calibrate", args: args }];
        return this.send(p);
    };
    /** Retrieves all of the event handlers for a particular event.
     * Returns an empty array if the event did not exist.
      */
    Farmbot.prototype.event = function (name) {
        this._events[name] = this._events[name] || [];
        return this._events[name];
    };
    ;
    Farmbot.prototype.on = function (event, callback) {
        this.event(event).push(callback);
    };
    ;
    Farmbot.prototype.emit = function (event, data) {
        [this.event(event), this.event("*")]
            .forEach(function (handlers) {
            handlers.forEach(function (handler) {
                try {
                    handler(data, event);
                }
                catch (e) {
                    console.warn("Exception thrown while handling `" + event + "` event.");
                }
            });
        });
    };
    Object.defineProperty(Farmbot.prototype, "channel", {
        get: function () {
            var uuid = this.getState()["uuid"] || "lost_and_found";
            return {
                /** From the browser, usually. */
                toDevice: "bot/" + uuid + "/from_clients",
                /** From farmbot */
                toClient: "bot/" + uuid + "/from_device",
                status: "bot/" + uuid + "/status",
                logs: "bot/" + uuid + "/logs"
            };
        },
        enumerable: true,
        configurable: true
    });
    Farmbot.prototype.publish = function (msg) {
        if (this.client) {
            /** SEE: https://github.com/mqttjs/MQTT.js#client */
            this.client.publish(this.channel.toDevice, JSON.stringify(msg));
        }
        else {
            throw new Error("Not connected to server");
        }
    };
    ;
    Farmbot.prototype.send = function (input) {
        var that = this;
        var done = false;
        return new Promise(function (resolve, reject) {
            console.log("Sent: " + input.args.label);
            that.publish(input);
            var label = (input.body || []).map(function (x) { return x.kind; }).join(", ");
            var time = that.getState()["timeout"];
            setTimeout(function () {
                if (!done) {
                    reject(new Error(label + " timeout after " + time + " ms."));
                }
            }, time);
            that.on(input.args.label, function (response) {
                console.log("Got " + (response.args.label || "??"));
                done = true;
                switch (response.kind) {
                    case "rpc_ok": return resolve(response);
                    case "rpc_error":
                        var reason = (response.body || []).map(function (x) { return x.args.message; }).join(", ");
                        return reject(new Error("Problem sending RPC command: " + reason));
                    default:
                        console.dir(response);
                        throw new Error("Got a bad CeleryScript node.");
                }
            });
        });
    };
    ;
    /** Main entry point for all MQTT packets. */
    Farmbot.prototype._onmessage = function (chan, buffer) {
        try {
            /** UNSAFE CODE: TODO: Add user defined type guards? */
            var msg = JSON.parse(buffer.toString());
        }
        catch (error) {
            throw new Error("Could not parse inbound message from MQTT.");
        }
        switch (chan) {
            case this.channel.logs: return this.emit("logs", msg);
            case this.channel.status: return this.emit("status", msg);
            case this.channel.toClient:
                if (util_2.isCeleryScript(msg)) {
                    return this.emit(msg.args.label, msg);
                }
                else {
                    console.warn("Got malformed message. Out of date firmware?");
                    return this.emit("malformed", msg);
                }
            default: throw new Error("Never should see this.");
        }
    };
    ;
    Farmbot.prototype.connect = function () {
        var that = this;
        var _a = that.getState(), uuid = _a.uuid, token = _a.token, mqttServer = _a.mqttServer, timeout = _a.timeout;
        that.client = mqtt_1.connect(mqttServer, {
            username: uuid,
            password: token
        });
        that.client.subscribe(that.channel.toClient);
        that.client.subscribe(that.channel.logs);
        that.client.subscribe(that.channel.status);
        that.client.on("message", that._onmessage.bind(that));
        var done = false;
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                if (!done) {
                    reject(new Error("Failed to connect to MQTT after " + timeout + " ms."));
                }
            }, timeout);
            that.client.once("connect", function () { return resolve(that); });
        });
    };
    return Farmbot;
}());
Farmbot.VERSION = "2.5.0rc13";
Farmbot.defaults = { speed: 100, timeout: 6000 };
exports.Farmbot = Farmbot;