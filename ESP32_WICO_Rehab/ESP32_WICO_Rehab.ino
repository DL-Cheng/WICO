#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>

const char* WIFI_SSID = "DL";
const char* WIFI_PASSWORD = "0932859879";

const char* MQTT_SERVER = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;
const char* DEVICE_ID = "wico-rehab-demo001";

const int LED_PIN = 2;
const int SERVO_PIN = 17;
const int IR_SENSOR_PIN = 27;

const int LIGHT_SERVO_ANGLE = 10;
const int HEAVY_SERVO_ANGLE = 40;

WiFiClient espClient;
PubSubClient mqttClient(espClient);
Servo rehabServo;

String commandTopic;
String statusTopic;

volatile unsigned long lightCount = 0;
volatile unsigned long heavyCount = 0;
bool sessionActive = false;
bool heavyMode = false;
bool lastIrState = HIGH;
unsigned long sessionStartMs = 0;
unsigned long lastPublishMs = 0;

void publishStatus() {
  unsigned long elapsedMs = sessionActive ? millis() - sessionStartMs : 0;
  unsigned long totalCount = lightCount + heavyCount;
  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"sessionActive\":" + String(sessionActive ? "true" : "false") + ",";
  payload += "\"force\":\"" + String(heavyMode ? "heavy" : "light") + "\",";
  payload += "\"lightCount\":" + String(lightCount) + ",";
  payload += "\"heavyCount\":" + String(heavyCount) + ",";
  payload += "\"totalCount\":" + String(totalCount) + ",";
  payload += "\"elapsedMs\":" + String(elapsedMs);
  payload += "}";
  mqttClient.publish(statusTopic.c_str(), payload.c_str());
}

void setLightForce() {
  heavyMode = false;
  digitalWrite(LED_PIN, LOW);
  rehabServo.write(LIGHT_SERVO_ANGLE);
  publishStatus();
}

void setHeavyForce() {
  heavyMode = true;
  digitalWrite(LED_PIN, HIGH);
  rehabServo.write(HEAVY_SERVO_ANGLE);
  publishStatus();
}

void startSession() {
  lightCount = 0;
  heavyCount = 0;
  sessionActive = true;
  sessionStartMs = millis();
  publishStatus();
}

void finishSession() {
  sessionActive = false;
  publishStatus();
}

void handleCommand(char* topic, byte* payload, unsigned int length) {
  String command;
  for (unsigned int i = 0; i < length; i++) {
    command += (char)payload[i];
  }
  command.trim();
  command.toUpperCase();

  if (command == "LIGHT") {
    setLightForce();
  } else if (command == "HEAVY") {
    setHeavyForce();
  } else if (command == "START") {
    startSession();
  } else if (command == "FINISH") {
    finishSession();
  } else if (command == "STATUS") {
    publishStatus();
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected: ");
  Serial.println(WiFi.localIP());
}

void reconnectMqtt() {
  while (!mqttClient.connected()) {
    String clientId = "esp32-" + String(DEVICE_ID) + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    Serial.print("Connecting to MQTT...");
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
      mqttClient.subscribe(commandTopic.c_str());
      publishStatus();
    } else {
      Serial.print("failed, rc=");
      Serial.println(mqttClient.state());
      delay(2000);
    }
  }
}

void readIrSensor() {
  bool irState = digitalRead(IR_SENSOR_PIN);
  if (sessionActive && irState != lastIrState && irState == LOW) {
    if (heavyMode) {
      heavyCount++;
    } else {
      lightCount++;
    }
    publishStatus();
  }
  lastIrState = irState;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(IR_SENSOR_PIN, INPUT_PULLUP);

  rehabServo.attach(SERVO_PIN);
  rehabServo.write(LIGHT_SERVO_ANGLE);

  commandTopic = "wico/rehab/" + String(DEVICE_ID) + "/cmd";
  statusTopic = "wico/rehab/" + String(DEVICE_ID) + "/status";

  connectWiFi();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(handleCommand);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqttClient.connected()) {
    reconnectMqtt();
  }

  mqttClient.loop();
  readIrSensor();

  if (millis() - lastPublishMs > 1000) {
    lastPublishMs = millis();
    publishStatus();
  }

  delay(20);
}
