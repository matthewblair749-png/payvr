Pod::Spec.new do |s|
  s.name           = 'PayvrNearby'
  s.version        = '0.1.0'
  s.summary        = 'Payvr tap-to-pay: Bluetooth LE advertising and Nearby Interaction'
  s.description    = 'Advertises the Payvr tap-session token over Bluetooth LE and measures UWB distance with Nearby Interaction.'
  s.license        = 'UNLICENSED'
  s.author         = 'Payvr'
  s.homepage       = 'https://payvr.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreBluetooth', 'NearbyInteraction'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
