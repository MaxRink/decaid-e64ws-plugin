import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:reaprime/src/plugins/plugin_package.dart';

void main() {
  for (final entry in {
    'repository root': 'E64_PACKAGE',
    'local ZIP extraction': 'E64_LOCAL_PACKAGE',
    'GitHub archive extraction': 'E64_GITHUB_PACKAGE',
  }.entries) {
    test('current upstream Decaid accepts ${entry.key}', () {
      final path = Platform.environment[entry.value];
      expect(path, isNotNull);
      final package = resolvePluginPackage(Directory(path!));
      expect(package.manifest.id, 'mahlkoenig-e64.reaplugin');
      expect(package.manifest.version, '0.7.6');
      final drivers = {
        for (final driver in package.manifest.drivers) driver.id: driver,
      };
      expect(drivers.keys, unorderedEquals(['e64', 'e64-control']));
      final readOnly = drivers['e64']!;
      expect(readOnly.type.name, 'grinder');
      expect(readOnly.grinderCapabilities, isEmpty);
      final control = drivers['e64-control']!;
      expect(control.type.name, 'grinder');
      expect(
        control.grinderCapabilities.map((value) => value.name),
        unorderedEquals(['startStop', 'grindSetting']),
      );
      for (final driver in drivers.values) {
        expect(driver.grinderObservations.map((value) => value.name), [
          'setting',
        ]);
        expect(driver.surfaces.single.role, 'diagnostics');
        expect(driver.surfaces.single.endpoint, 'e64-diagnostics');
      }
    });
  }
}
