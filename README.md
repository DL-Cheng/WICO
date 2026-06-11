# WICO Cloud Home Rehabilitation System

This project is a mobile-first web dashboard for a cloud-connected home rehabilitation device. It is designed for GitHub Pages deployment and uses MQTT through EMQX to control an ESP32.

## Features

- English single-page dashboard with WICO branding.
- Installable Web App support through `manifest.webmanifest` and `sw.js`.
- MQTT over WebSocket connection to EMQX from the web page.
- `Light Force` and `Heavy Force` buttons for GPIO17 servo control.
- `Start` and `Finish` session buttons with operation timer.
- Encouragement badge shown after finishing a session.
- GPIO27 IR sensor count display for total, light-force, and heavy-force repetitions.

## Web MQTT Settings

Default web settings:

- Broker WebSocket URL: `wss://broker.emqx.io:8084/mqtt`
- Device ID: `wico-rehab-demo001`
- Command topic: `wico/rehab/wico-rehab-demo001/cmd`
- Status topic: `wico/rehab/wico-rehab-demo001/status`

The web page publishes these command payloads:

- `START`
- `FINISH`
- `LIGHT`
- `HEAVY`
- `STATUS`

The ESP32 publishes JSON status payloads to the status topic.

## ESP32 Hardware

- GPIO17: Servo signal pin
- GPIO27: IR sensor input, using `INPUT_PULLUP`
- GPIO2: On-board LED mode indicator

## Arduino IDE Setup

Install these libraries in Arduino IDE:

- `ESP32Servo`
- `PubSubClient`

Open `ESP32_WICO_Rehab.ino`, then update:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* DEVICE_ID = "wico-rehab-demo001";
```

The `DEVICE_ID` must match the web page Device ID.

## GitHub Pages Deployment

1. Upload all files to a GitHub repository.
2. In repository settings, enable GitHub Pages for the branch containing `index.html`.
3. Open the published URL on a phone.
4. Use the browser install option to add the Web App to the home screen.

## Files

- `index.html`: Single-page web dashboard.
- `styles.css`: Mobile-first responsive visual design.
- `app.js`: Timer, MQTT connection, controls, and dashboard updates.
- `manifest.webmanifest`: Installable Web App metadata.
- `sw.js`: Offline cache service worker.
- `assets/icon.svg`, `assets/icon-192.png`, `assets/icon-512.png`: WICO rehabilitation Web App icons.
- `ESP32_WICO_Rehab.ino`: ESP32 WiFi MQTT firmware for Arduino IDE.
- `ESP32_BT.ino`: Original Bluetooth reference program.
