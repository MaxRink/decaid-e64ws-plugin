import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:reaprime/src/plugins/plugin_package.dart';

void main() {
  for (final entry in {
    'repository root': 'E64_PACKAGE',
    'local ZIP extraction': 'E64_LOCAL_PACKAGE',
    'GitHub archive extraction': 'E64_GITHUB_PACKAGE',
  }.entries) {
    test('current pinned Decaid accepts ${entry.key}', () {
      final path = Platform.environment[entry.value];
      expect(path, isNotNull);
      final package = resolvePluginPackage(Directory(path!));
      expect(package.manifest.id, 'mahlkoenig-e64.reaplugin');
      expect(package.manifest.version, '0.2.0');
      final driver = package.manifest.drivers.single;
      expect(driver.type.name, 'grinder');
      expect(driver.grinderCapabilities, isEmpty);
      expect(driver.grinderObservations.map((value) => value.name), [
        'setting',
      ]);
      expect(driver.surfaces.single.role, 'diagnostics');
      expect(driver.surfaces.single.endpoint, 'e64-diagnostics');
    });
  }
}
