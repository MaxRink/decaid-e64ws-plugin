// Runs plugin.js inside the real Decaid QuickJS host against the E64 WS
// simulator from the private research repository (E64_SIM_ROOT). The host's
// own fetch and transport perform the login, TLS pinning and WSS session.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:reaprime/src/models/device/grinder_device.dart';
import 'package:reaprime/src/plugins/plugin_device_service.dart';
import 'package:reaprime/src/plugins/plugin_grinder.dart';
import 'package:reaprime/src/plugins/plugin_manager.dart';
import 'package:reaprime/src/plugins/plugin_manifest.dart';
import 'package:reaprime/src/services/storage/kv_store_service.dart';

class _Store implements KeyValueStoreService {
  final values = <String, Object>{};
  @override
  Future<void> initialize() async {}
  @override
  Future<void> set({
    String namespace = 'default',
    required String key,
    required Object value,
  }) async => values[key] = value;
  @override
  Future<bool> delete({
    String namespace = 'default',
    required String key,
  }) async => values.remove(key) != null;
  @override
  Future<Object?> get({
    String namespace = 'default',
    required String key,
  }) async => values[key];
  @override
  Future<List<String>> keys({String namespace = 'default'}) async =>
      values.keys.toList();
  @override
  List<String> get namespaces => const [];
  @override
  Future<Map<String, Object>> getAll({String namespace = 'default'}) async =>
      Map.of(values);
}

Future<int> _freePort() async {
  final socket = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
  final port = socket.port;
  await socket.close();
  return port;
}

void main() {
  final pluginRoot = Platform.environment['E64_PLUGIN_ROOT'];
  final simRoot = Platform.environment['E64_SIM_ROOT'];
  final simScript = '$simRoot/tools/e64ws_simulator.py';
  final optional = Platform.environment['E64_SIM_OPTIONAL'] == '1';
  final missing = simRoot == null || !File(simScript).existsSync();

  test(
    'plugin mints, pins and reads the E64 simulator through the Decaid host',
    () async {
      expect(pluginRoot, isNotNull, reason: 'E64_PLUGIN_ROOT is required');
      expect(missing, isFalse, reason: 'E64_SIM_ROOT must point at the research repository');
      final temp = await Directory.systemTemp.createTemp('e64-host-sim-');
      final cert = '${temp.path}/cert.pem', key = '${temp.path}/key.pem';
      final made = await Process.run('openssl', [
        'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
        '-nodes', '-days', '2', '-subj', '/CN=e64-sim', '-keyout', key, '-out', cert,
      ]);
      expect(made.exitCode, 0, reason: '${made.stderr}');
      final fingerprint = await Process.run('openssl', [
        'x509', '-noout', '-fingerprint', '-sha256', '-in', cert,
      ]);
      final pin = (fingerprint.stdout as String).trim().split('=').last;
      final wsPort = await _freePort(), httpPort = await _freePort();
      final python = Platform.environment['E64_SIM_PYTHON'] ??
          (File('$simRoot/.venv/bin/python').existsSync()
              ? '$simRoot/.venv/bin/python'
              : 'python3');
      final sim = await Process.start(python, [
        '-u', simScript, '--host', '127.0.0.1', '--port', '$wsPort',
        '--scale-port', '${await _freePort()}', '--http-port', '$httpPort',
        '--token', 'host-sim-token', '--tls-cert', cert, '--tls-key', key,
        '--http-tls-cert', cert, '--http-tls-key', key,
      ], workingDirectory: simRoot);
      final output = StringBuffer();
      sim.stdout.transform(utf8.decoder).listen(output.write);
      sim.stderr.transform(utf8.decoder).listen(output.write);
      addTearDown(() async {
        sim.kill();
        await sim.exitCode;
        await temp.delete(recursive: true);
      });
      final deadline = DateTime.now().add(const Duration(seconds: 15));
      while (!output.toString().contains('E64 simulator:')) {
        expect(DateTime.now().isBefore(deadline), isTrue, reason: '$output');
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }

      Future<void> control(String route, Map<String, dynamic> body) async {
        final client = HttpClient()..badCertificateCallback = (_, _, _) => true;
        final request = await client.postUrl(Uri.parse('https://127.0.0.1:$httpPort$route'));
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
        final response = await request.close();
        await response.drain<void>();
        client.close();
        expect(response.statusCode, 200);
      }

      final service = PluginDeviceService();
      final manager = PluginManager(
        kvStore: _Store(),
        deviceService: service,
        deviceInvocationTimeout: const Duration(seconds: 10),
      );
      addTearDown(() async {
        await manager.dispose();
        await service.dispose();
      });
      final manifest = PluginManifest.fromJson(
        jsonDecode(await File('$pluginRoot/manifest.json').readAsString()),
      );
      Map<String, dynamic> instance(String? certSha256) => {
        'id': 'sim', 'name': 'Simulator', 'scheme': 'wss', 'host': '127.0.0.1',
        'port': wsPort, 'restPort': httpPort, 'pollMs': 100,
        'certSha256': ?certSha256,
      };
      Future<PluginGrinder> load(String? certSha256) async {
        await manager.loadPlugin(
          id: manifest.id,
          manifest: manifest,
          settings: {
            'InstancesJson': jsonEncode([instance(certSha256)]),
            'TokensJson': '{}',
            'MintTokens': 'true',
            'PasswordsJson': jsonEncode({
              'sim': {'host': '127.0.0.1', 'password': 'sim-password'},
            }),
          },
          jsCode: await File('$pluginRoot/plugin.js').readAsString(),
        );
        return (await service.devices
                .where((devices) => devices.length == 1)
                .first
                .timeout(const Duration(seconds: 5)))
            .cast<PluginGrinder>()
            .single;
      }

      final unpinned = await load(null);
      await expectLater(
        unpinned.onConnect(),
        throwsA(predicate((e) => '$e'.contains('login request failed'))),
      );
      await manager.unloadPlugin(manifest.id);

      final device = await load(pin);
      await device.onConnect();
      final first = await device.currentSnapshot.first.timeout(
        const Duration(seconds: 5),
      );
      expect(first.state, GrinderState.idle);
      expect(first.observedSetting, '500');

      await control('/sim/action', {
        'suffix': 'SetAgsaTargetDdValue',
        'data': {'targetDdValue': 4325},
      });
      await device.currentSnapshot
          .firstWhere((snapshot) => snapshot.observedSetting == '433')
          .timeout(const Duration(seconds: 5));
      await control('/sim/action', {'suffix': 'StartGrindManual', 'data': {}});
      await device.currentSnapshot
          .firstWhere((snapshot) => snapshot.state == GrinderState.grinding)
          .timeout(const Duration(seconds: 5));

      Future<Map<String, dynamic>> request(Map<String, dynamic> value) async {
        final id = 'request-${DateTime.now().microsecondsSinceEpoch}';
        final response = manager.registerPendingHttp(manifest.id, id);
        manager.dispatchEvent(manifest.id, 'httpRequest', {'requestId': id, ...value});
        return await response.timeout(const Duration(seconds: 5));
      }

      final connection = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'GET',
        'query': {'deviceId': device.deviceId, 'read': 'connection'},
      });
      expect(connection['status'], 200);
      expect(jsonDecode(connection['body'] as String)['tokenSource'], 'password');
      final known = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'GET',
        'query': {'deviceId': device.deviceId},
      });
      final state = (jsonDecode(known['body'] as String) as Map)['state'] as Map;
      expect(state['ddValueDum'], 4325);
      expect(state.containsKey('sessionId'), isFalse);
      for (final response in [connection, known]) {
        expect(response['body'], isNot(contains('sim-password')));
        expect(response['body'], isNot(contains('host-sim-token')));
      }
      await manager.unloadPlugin(manifest.id);
    },
    skip: missing && optional
        ? 'E64 simulator not found; skipped because E64_SIM_OPTIONAL=1'
        : false,
  );
}
