package expo.modules.payvrnearby

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

/**
 * Payvr tap-to-pay native pieces for Android: Bluetooth LE advertising of the tap-session
 * token (as a 128-bit service UUID). Scanning is done in JS with react-native-ble-plx.
 * Nearby Interaction is iOS-only, so those functions report "unsupported".
 *
 * Runtime permissions (BLUETOOTH_ADVERTISE / SCAN / CONNECT) are requested from JS before
 * any of this runs, hence the MissingPermission suppression.
 */
@SuppressLint("MissingPermission")
class PayvrNearbyModule : Module() {
  private var advertiser: BluetoothLeAdvertiser? = null
  private var callback: AdvertiseCallback? = null

  override fun definition() = ModuleDefinition {
    Name("PayvrNearby")

    Events("onDistance", "onNearbyError")

    Function("isNearbyInteractionSupported") { false }

    AsyncFunction("startAdvertising") { serviceUuid: String, promise: Promise ->
      stopAdvertising()

      val uuid = try {
        UUID.fromString(serviceUuid)
      } catch (e: IllegalArgumentException) {
        promise.reject("ERR_INVALID_UUID", "Not a valid UUID: $serviceUuid", e)
        return@AsyncFunction
      }

      val context = appContext.reactContext
      val adapter = (context?.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
      if (adapter == null) {
        promise.reject("ERR_UNSUPPORTED", "Bluetooth is not available on this device", null)
        return@AsyncFunction
      }
      if (!adapter.isEnabled) {
        promise.reject("ERR_BLUETOOTH_OFF", "Bluetooth is off", null)
        return@AsyncFunction
      }
      val le = adapter.bluetoothLeAdvertiser
      if (le == null) {
        promise.reject("ERR_UNSUPPORTED", "This phone cannot advertise over Bluetooth LE", null)
        return@AsyncFunction
      }

      val settings = AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
        .setConnectable(false)
        .build()
      val data = AdvertiseData.Builder()
        .setIncludeDeviceName(false)
        .setIncludeTxPowerLevel(false)
        .addServiceUuid(ParcelUuid(uuid))
        .build()

      val cb = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
          promise.resolve(true)
        }

        override fun onStartFailure(errorCode: Int) {
          if (callback === this) {
            callback = null
            advertiser = null
          }
          promise.reject("ERR_ADVERTISE", "Bluetooth advertising failed (code $errorCode)", null)
        }
      }

      try {
        advertiser = le
        callback = cb
        le.startAdvertising(settings, data, cb)
      } catch (e: SecurityException) {
        advertiser = null
        callback = null
        promise.reject("ERR_UNAUTHORIZED", "Bluetooth permission was denied", e)
      }
    }

    AsyncFunction("stopAdvertising") {
      stopAdvertising()
    }

    AsyncFunction("startNearbyInteraction") { -> nearbyUnsupported<String>() }

    AsyncFunction("runNearbyInteraction") { _: String -> nearbyUnsupported<Unit>() }

    AsyncFunction("stopNearbyInteraction") {}

    OnDestroy {
      stopAdvertising()
    }
  }

  // Typed helper: a lambda that only throws would infer `Nothing`, which Expo's reified
  // AsyncFunction builders can't accept.
  private fun <T> nearbyUnsupported(): T =
    throw CodedException("ERR_UNSUPPORTED", "Nearby Interaction is only available on iPhone", null)

  private fun stopAdvertising() {
    val cb = callback ?: return
    try {
      advertiser?.stopAdvertising(cb)
    } catch (_: SecurityException) {
      // Permission revoked while advertising; nothing left to stop.
    }
    callback = null
    advertiser = null
  }
}
