import CoreBluetooth
import ExpoModulesCore
import NearbyInteraction

/// Payvr tap-to-pay native pieces for iOS:
/// - Bluetooth LE advertising of the tap-session token (as a 128-bit service UUID).
///   Scanning is done in JS with react-native-ble-plx.
/// - Nearby Interaction (UWB) distance to the other iPhone.
/// Everything runs on the main queue and only while the Tap screen is open.
public class PayvrNearbyModule: Module {
  private lazy var advertiser = BleAdvertiser()
  private lazy var nearby = NearbyController()

  public func definition() -> ModuleDefinition {
    Name("PayvrNearby")

    Events("onDistance", "onNearbyError")

    OnCreate {
      self.nearby.onDistance = { [weak self] distance in
        self?.sendEvent("onDistance", ["distance": distance])
      }
      self.nearby.onError = { [weak self] message in
        self?.sendEvent("onNearbyError", ["message": message])
      }
    }

    Function("isNearbyInteractionSupported") { () -> Bool in
      return NISession.deviceCapabilities.supportsPreciseDistanceMeasurement
    }

    AsyncFunction("startAdvertising") { (serviceUuid: String, promise: Promise) in
      self.advertiser.start(serviceUuid: serviceUuid, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("stopAdvertising") {
      self.advertiser.stop()
    }.runOnQueue(.main)

    AsyncFunction("startNearbyInteraction") { () throws -> String in
      return try self.nearby.start()
    }.runOnQueue(.main)

    AsyncFunction("runNearbyInteraction") { (peerToken: String) throws in
      try self.nearby.run(peerToken: peerToken)
    }.runOnQueue(.main)

    AsyncFunction("stopNearbyInteraction") {
      self.nearby.stop()
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async {
        self.advertiser.stop()
        self.nearby.stop()
      }
    }
  }
}

internal final class NearbyException: Exception {
  private let message: String

  init(_ message: String) {
    self.message = message
    super.init()
  }

  override var reason: String {
    return message
  }
}

// MARK: - Bluetooth LE advertising

/// Advertises one service UUID. The UUID *is* the tap token, so no GATT data is served;
/// a matching (empty) primary service is published because some iOS versions only
/// advertise UUIDs for services that exist.
internal final class BleAdvertiser: NSObject, CBPeripheralManagerDelegate {
  private struct Pending {
    let uuid: CBUUID
    let promise: Promise
  }

  private var manager: CBPeripheralManager?
  private var pending: Pending?

  func start(serviceUuid: String, promise: Promise) {
    stop()
    guard UUID(uuidString: serviceUuid) != nil else {
      promise.reject("ERR_INVALID_UUID", "Not a valid UUID: \(serviceUuid)")
      return
    }
    pending = Pending(uuid: CBUUID(string: serviceUuid), promise: promise)
    if let manager = manager {
      peripheralManagerDidUpdateState(manager)
    } else {
      // Creating the manager triggers the Bluetooth permission prompt the first time.
      manager = CBPeripheralManager(delegate: self, queue: nil)
    }
  }

  func stop() {
    if let manager = manager {
      if manager.isAdvertising {
        manager.stopAdvertising()
      }
      manager.removeAllServices()
    }
    if let pending = pending {
      self.pending = nil
      pending.promise.reject("ERR_CANCELLED", "Advertising was stopped")
    }
  }

  private func fail(_ code: String, _ message: String) {
    guard let pending = pending else { return }
    self.pending = nil
    pending.promise.reject(code, message)
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    guard let pending = pending else { return }
    switch peripheral.state {
    case .poweredOn:
      peripheral.removeAllServices()
      peripheral.add(CBMutableService(type: pending.uuid, primary: true))
    case .poweredOff:
      fail("ERR_BLUETOOTH_OFF", "Bluetooth is off")
    case .unauthorized:
      fail("ERR_UNAUTHORIZED", "Bluetooth permission was denied")
    case .unsupported:
      fail("ERR_UNSUPPORTED", "This device does not support Bluetooth LE advertising")
    default:
      // .unknown / .resetting: wait for the next state update.
      break
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    guard let pending = pending else { return }
    if let error = error {
      fail("ERR_ADVERTISE", error.localizedDescription)
      return
    }
    peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [pending.uuid]])
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    guard let pending = pending else { return }
    self.pending = nil
    if let error = error {
      pending.promise.reject("ERR_ADVERTISE", error.localizedDescription)
    } else {
      pending.promise.resolve(true)
    }
  }
}

// MARK: - Nearby Interaction (UWB)

internal final class NearbyController: NSObject, NISessionDelegate {
  var onDistance: ((Double?) -> Void)?
  var onError: ((String) -> Void)?

  private var session: NISession?

  /// Starts a session and returns this phone's discovery token, archived and base64 encoded.
  func start() throws -> String {
    guard NISession.deviceCapabilities.supportsPreciseDistanceMeasurement else {
      throw NearbyException("Nearby Interaction is not supported on this iPhone")
    }
    stop()
    let session = NISession()
    session.delegate = self
    self.session = session
    guard let token = session.discoveryToken else {
      throw NearbyException("Nearby Interaction did not provide a discovery token")
    }
    let data = try NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true)
    return data.base64EncodedString()
  }

  func run(peerToken: String) throws {
    guard let session = session else {
      throw NearbyException("Start Nearby Interaction first")
    }
    guard
      let data = Data(base64Encoded: peerToken),
      let token = try NSKeyedUnarchiver.unarchivedObject(ofClass: NIDiscoveryToken.self, from: data)
    else {
      throw NearbyException("Invalid peer discovery token")
    }
    session.run(NINearbyPeerConfiguration(peerToken: token))
  }

  func stop() {
    session?.invalidate()
    session = nil
  }

  func session(_ session: NISession, didUpdate nearbyObjects: [NINearbyObject]) {
    guard let distance = nearbyObjects.first?.distance else { return }
    onDistance?(Double(distance))
  }

  func session(_ session: NISession, didRemove nearbyObjects: [NINearbyObject], reason: NINearbyObject.RemovalReason) {
    onDistance?(nil)
  }

  func session(_ session: NISession, didInvalidateWith error: Error) {
    if self.session === session {
      self.session = nil
    }
    onError?(error.localizedDescription)
  }
}
