import Foundation
import Capacitor
import LocalAuthentication

@objc(BiometricAuthPlugin)
public class BiometricAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricAuthPlugin"
    public let jsName = "BiometricAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verify", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        var biometryType = 0
        if available {
            switch context.biometryType {
            case .touchID: biometryType = 1
            case .faceID: biometryType = 2
            case .opticID: biometryType = 3
            default: biometryType = 0
            }
        }
        call.resolve([
            "isAvailable": available,
            "biometryType": biometryType,
        ])
    }

    @objc func verify(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Authenticate"
        let context = LAContext()
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["verified": true])
                } else {
                    call.reject(error?.localizedDescription ?? "Authentication failed")
                }
            }
        }
    }
}
