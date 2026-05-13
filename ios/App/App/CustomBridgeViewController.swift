import Capacitor

// Custom Capacitor bridge controller. Used instead of the stock
// CAPBridgeViewController so we can explicitly register in-app plugins
// at load time.
//
// Why: Capacitor's auto-discovery walks Obj-C runtime classes for
// CAPBridgedPlugin conformance at app startup. In Release builds with
// SPM-based projects (Capacitor 8), local plugins compiled into the
// app target don't reliably show up in that enumeration — neither
// `_ = X.self` nor a stored instance in AppDelegate were enough to
// surface BiometricAuthPlugin. Registering by hand sidesteps the
// auto-discovery entirely.
class CustomBridgeViewController: CAPBridgeViewController {
    open override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BiometricAuthPlugin())
    }
}
