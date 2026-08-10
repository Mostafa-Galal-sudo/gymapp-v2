import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';

// Standard Bluetooth SIG "Heart Rate" service/characteristic UUIDs.
// numberToUUID expands the 16-bit assigned number into the full 128-bit UUID
// (e.g. 0x180d -> '0000180d-0000-1000-8000-00805f9b34fb').
const HEART_RATE_SERVICE = numberToUUID(0x180d);
const HEART_RATE_MEASUREMENT = numberToUUID(0x2a37);

let initialized = false;
let connectedDeviceId: string | null = null;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  // androidNeverForLocation: we only read heart rate, we never use scan
  // results to infer the user's physical location, so we can use the
  // narrower BLUETOOTH_SCAN permission instead of also asking for location.
  await BleClient.initialize({ androidNeverForLocation: true });
  initialized = true;
}

export interface HeartRateConnection {
  deviceId: string;
  deviceName: string;
}

/**
 * Scan for and connect to a BLE heart-rate monitor, then subscribe to live
 * readings. Works on native Android/iOS (via the Capacitor BLE bridge) *and*
 * on desktop/Android Chrome (the plugin falls back to the Web Bluetooth API
 * automatically) — unlike calling `navigator.bluetooth` directly, which
 * silently doesn't exist inside a Capacitor WebView.
 */
export async function connectHeartRateMonitor(
  onHeartRate: (hr: number) => void,
  onDisconnect: () => void
): Promise<HeartRateConnection> {
  await ensureInitialized();

  const device = await BleClient.requestDevice({
    services: [HEART_RATE_SERVICE],
    optionalServices: [HEART_RATE_SERVICE],
  });

  try {
    await BleClient.connect(device.deviceId, () => {
      connectedDeviceId = null;
      onDisconnect();
    });

    await BleClient.startNotifications(
      device.deviceId,
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (value) => {
        // Heart Rate Measurement characteristic layout (Bluetooth SIG spec):
        // byte 0 = flags, bit 0 tells us whether the HR value is 8-bit or 16-bit.
        const flags = value.getUint8(0);
        const is16bit = (flags & 0x1) === 1;
        const hr = is16bit ? value.getUint16(1, true) : value.getUint8(1);
        onHeartRate(hr);
      }
    );
  } catch (err) {
    // We already established a GATT connection above — if subscribing to
    // notifications (or anything after connect) fails, don't leave the
    // device connected with no way for the app to ever disconnect it again.
    try { await BleClient.disconnect(device.deviceId); } catch { /* best effort */ }
    throw err;
  }

  connectedDeviceId = device.deviceId;
  return { deviceId: device.deviceId, deviceName: device.name || 'Heart Rate Monitor' };
}

/** Stop notifications and disconnect the currently connected device, if any. */
export async function disconnectHeartRateMonitor(deviceId?: string | null): Promise<void> {
  const id = deviceId ?? connectedDeviceId;
  if (!id) return;
  connectedDeviceId = null;
  try {
    await BleClient.stopNotifications(id, HEART_RATE_SERVICE, HEART_RATE_MEASUREMENT);
  } catch {
    // device may already be gone — nothing to clean up
  }
  try {
    await BleClient.disconnect(id);
  } catch {
    // already disconnected
  }
}
