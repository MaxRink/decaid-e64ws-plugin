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

/// The research E64 WS simulator with a fresh self-signed certificate and
/// HTTPS REST login. Reusable by other host tests: start it with
/// `E64Sim.start(simRoot, devGate: 'open')` (a development image that accepts
/// control) or `'locked'` (a shipped image), and load the plugin with
/// `sim.settings(control: true, owner: 'decaid')`. `extraArgs` are passed to
/// the simulator unchanged, e.g. `['--replay', trace]`.
class E64Sim {
  E64Sim._(this._process, this._temp, this.wsPort, this.httpPort, this.pin);

  final Process _process;
  final Directory _temp;
  final int wsPort;
  final int httpPort;
  final String pin;

  static Future<E64Sim> start(
    String simRoot, {
    String devGate = 'open',
    List<String> extraArgs = const [],
  }) async {
    final temp = await Directory.systemTemp.createTemp('e64-host-sim-');
    final cert = '${temp.path}/cert.pem', key = '${temp.path}/key.pem';
    final made = await Process.run('openssl', [
      'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
      '-nodes', '-days', '2', '-subj', '/CN=e64-sim', '-keyout', key, '-out', cert,
    ]);
    if (made.exitCode != 0) throw StateError('openssl failed: ${made.stderr}');
    final fingerprint = await Process.run('openssl', [
      'x509', '-noout', '-fingerprint', '-sha256', '-in', cert,
    ]);
    final pin = (fingerprint.stdout as String).trim().split('=').last;
    final wsPort = await _freePort(), httpPort = await _freePort();
    final python = Platform.environment['E64_SIM_PYTHON'] ??
        (File('$simRoot/.venv/bin/python').existsSync()
            ? '$simRoot/.venv/bin/python'
            : 'python3');
    final process = await Process.start(python, [
      '-u', '$simRoot/tools/e64ws_simulator.py', '--host', '127.0.0.1',
      '--port', '$wsPort', '--scale-port', '${await _freePort()}',
      '--http-port', '$httpPort', '--token', 'host-sim-token',
      '--tls-cert', cert, '--tls-key', key,
      '--http-tls-cert', cert, '--http-tls-key', key, '--dev-gate', devGate,
      ...extraArgs,
    ], workingDirectory: simRoot);
    final output = StringBuffer();
    process.stdout.transform(utf8.decoder).listen(output.write);
    process.stderr.transform(utf8.decoder).listen(output.write);
    final deadline = DateTime.now().add(const Duration(seconds: 30));
    while (!output.toString().contains('E64 simulator:')) {
      if (DateTime.now().isAfter(deadline)) {
        process.kill();
        throw StateError('simulator did not start: $output');
      }
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }
    return E64Sim._(process, temp, wsPort, httpPort, pin);
  }

  /// Plugin settings for this simulator: Owner-password minting over pinned
  /// HTTPS (`restPort`) and WSS. `control: true` sets AllowControl, which
  /// registers the `e64-control` driver when the simulator runs `--dev-gate open`.
  Map<String, String> settings({
    bool pinned = true,
    bool control = false,
    String owner = 'off',
    int pollMs = 100,
  }) => {
    'InstancesJson': jsonEncode([
      {
        'id': 'sim', 'name': 'Simulator', 'scheme': 'wss', 'host': '127.0.0.1',
        'port': wsPort, 'restPort': httpPort, 'pollMs': pollMs,
        if (pinned) 'certSha256': pin,
      },
    ]),
    'TokensJson': '{}',
    'MintTokens': 'true',
    'PasswordsJson': jsonEncode({
      'sim': {'host': '127.0.0.1', 'password': 'sim-password'},
    }),
    if (control) 'AllowControl': 'true',
    'AdjustmentOwner': owner,
  };

  /// Test-only control API (`/sim/action`, `/sim/replay/seek`, ...).
  Future<Map<String, dynamic>> control(String route, [Map<String, dynamic>? body]) async {
    final client = HttpClient()..badCertificateCallback = (_, _, _) => true;
    try {
      final uri = Uri.parse('https://127.0.0.1:$httpPort$route');
      final request = body == null ? await client.getUrl(uri) : await client.postUrl(uri);
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }
      final response = await request.close();
      final text = await response.transform(utf8.decoder).join();
      if (response.statusCode != 200) throw StateError('sim $route ${response.statusCode} $text');
      return jsonDecode(text) as Map<String, dynamic>;
    } finally {
      client.close();
    }
  }

  Future<void> stop() async {
    _process.kill();
    await _process.exitCode;
    if (await _temp.exists()) await _temp.delete(recursive: true);
  }
}

void main() {
  final pluginRoot = Platform.environment['E64_PLUGIN_ROOT'];
  final simRoot = Platform.environment['E64_SIM_ROOT'];
  final optional = Platform.environment['E64_SIM_OPTIONAL'] == '1';
  final missing =
      simRoot == null || !File('$simRoot/tools/e64ws_simulator.py').existsSync();

  test(
    'plugin mints, pins, reads and controls the E64 simulator through the Decaid host',
    () async {
      expect(pluginRoot, isNotNull, reason: 'E64_PLUGIN_ROOT is required');
      expect(missing, isFalse, reason: 'E64_SIM_ROOT must point at the research repository');
      final service = PluginDeviceService();
      final manager = PluginManager(
        kvStore: _Store(),
        deviceService: service,
        deviceInvocationTimeout: const Duration(seconds: 10),
      );
      E64Sim? sim;
      addTearDown(() async {
        await manager.dispose();
        await service.dispose();
        await sim?.stop();
      });
      final manifest = PluginManifest.fromJson(
        jsonDecode(await File('$pluginRoot/manifest.json').readAsString()),
      );
      Future<PluginGrinder> load(Map<String, String> settings) async {
        await manager.loadPlugin(
          id: manifest.id,
          manifest: manifest,
          settings: settings,
          jsCode: await File('$pluginRoot/plugin.js').readAsString(),
        );
        return (await service.devices
                .where((devices) => devices.length == 1)
                .first
                .timeout(const Duration(seconds: 10)))
            .cast<PluginGrinder>()
            .single;
      }

      Future<Map<String, dynamic>> request(Map<String, dynamic> value) async {
        final id = 'request-${DateTime.now().microsecondsSinceEpoch}';
        final response = manager.registerPendingHttp(manifest.id, id);
        manager.dispatchEvent(manifest.id, 'httpRequest', {'requestId': id, ...value});
        return await response.timeout(const Duration(seconds: 5));
      }

      sim = await E64Sim.start(simRoot!, devGate: 'locked');
      final unpinned = await load(sim.settings(pinned: false));
      await expectLater(
        unpinned.onConnect(),
        throwsA(predicate((e) => '$e'.contains('login request failed'))),
      );
      await manager.unloadPlugin(manifest.id);

      final device = await load(sim.settings());
      await device.onConnect();
      final first = await device.currentSnapshot.first.timeout(
        const Duration(seconds: 5),
      );
      expect(first.state, GrinderState.idle);
      expect(first.observedSetting, '500');
      await sim.control('/sim/action', {
        'suffix': 'SetAgsaTargetDdValue',
        'data': {'targetDdValue': 4325},
      });
      await device.currentSnapshot
          .firstWhere((snapshot) => snapshot.observedSetting == '433')
          .timeout(const Duration(seconds: 5));
      await sim.control('/sim/action', {'suffix': 'StartGrindManual', 'data': {}});
      await device.currentSnapshot
          .firstWhere((snapshot) => snapshot.state == GrinderState.grinding)
          .timeout(const Duration(seconds: 5));
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

      final locked = await load(sim.settings(control: true, owner: 'decaid'));
      expect(locked.capabilities, isEmpty, reason: 'a locked grinder stays read-only');
      await manager.unloadPlugin(manifest.id);
      await sim.stop();

      sim = await E64Sim.start(simRoot!, devGate: 'open');
      final controlled = await load(sim.settings(control: true, owner: 'decaid'));
      expect(controlled.deviceId, 'plugin:mahlkoenig-e64.reaplugin:e64-control:sim');
      expect(
        controlled.capabilities.map((capability) => capability.name),
        containsAll(['startStop', 'grindSetting']),
      );
      await controlled.onConnect();
      await controlled.setGrindSetting('505');
      await controlled.currentSnapshot
          .firstWhere((snapshot) => snapshot.observedSetting == '505')
          .timeout(const Duration(seconds: 5));
      expect(((await sim.control('/sim/state'))['grinder'] as Map)['ddValueDum'], 5050);
      await controlled.start();
      await controlled.currentSnapshot
          .firstWhere((snapshot) => snapshot.state == GrinderState.grinding)
          .timeout(const Duration(seconds: 5));
      await controlled.stop();
      await controlled.currentSnapshot
          .firstWhere((snapshot) => snapshot.state == GrinderState.idle)
          .timeout(const Duration(seconds: 5));
      await manager.unloadPlugin(manifest.id);

      // Grind log through the host's binary fetch, then a brew event with the
      // real grind UUID. Decaid's own shot API is served on 127.0.0.1:8080.
      final shots = await HttpServer.bind(InternetAddress.loopbackIPv4, 8080);
      addTearDown(() => shots.close(force: true));
      final shotStart = DateTime.now().toUtc();
      shots.listen((request) {
        final found = request.uri.path == '/api/v1/shots/shot-1';
        request.response.statusCode = found ? 200 : 404;
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode(found
            ? {
                'id': 'shot-1',
                'timestamp': shotStart.toIso8601String(),
                'measurements': [
                  {'machine': {'timestamp': shotStart.toIso8601String()}, 'scale': {'weight': 0}},
                  {
                    'machine': {
                      'timestamp': shotStart.add(const Duration(seconds: 28)).toIso8601String(),
                    },
                    'scale': {'weight': 36.4},
                  },
                ],
              }
            : {'error': 'not found'}));
        request.response.close();
      });
      final owner = await load(sim.settings(control: true, owner: 'grinder'));
      await owner.onConnect();
      await owner.start();
      await owner.currentSnapshot
          .firstWhere((snapshot) => snapshot.state == GrinderState.grinding)
          .timeout(const Duration(seconds: 5));
      await owner.stop();
      Map<String, dynamic>? grind;
      Object? lastBody;
      final logDeadline = DateTime.now().add(const Duration(seconds: 20));
      while (grind?['grindUuid'] == null) {
        expect(DateTime.now().isBefore(logDeadline), isTrue, reason: 'grind log enrichment: $lastBody');
        await Future<void>.delayed(const Duration(milliseconds: 200));
        final events = await request({
          'endpoint': 'grind-events',
          'method': 'GET',
          'query': {'deviceId': owner.deviceId},
        });
        final body = jsonDecode(events['body'] as String) as Map<String, dynamic>;
        lastBody = body;
        expect((body['log'] as Map)['status'], isNot('unsupported-host'));
        final list = body['events'] as List;
        grind = list.isEmpty ? null : list.first as Map<String, dynamic>;
      }
      expect(grind!['recipe'], {
        'index': 1, 'uuid': '00000000-0000-4000-8000-000000000001', 'mode': 'GbW',
        'type': 'Espresso, double', 'amountGr': 18, 'setting': '50',
        'brewTimeMs': 27000, 'brewWeightGr': 36,
      });
      manager.dispatchEvent(manifest.id, 'shotStored', {'id': 'shot-1'});
      Map<String, dynamic>? brew;
      final brewDeadline = DateTime.now().add(const Duration(seconds: 10));
      while (brew == null) {
        expect(DateTime.now().isBefore(brewDeadline), isTrue, reason: 'AddBrewEvent');
        await Future<void>.delayed(const Duration(milliseconds: 200));
        brew = (await sim.control('/sim/state'))['lastBrewEvent'] as Map<String, dynamic>?;
      }
      expect(brew['grindUuid'], grind!['grindUuid']);
      expect(brew['brewTimeMs'], 28000);
      expect(brew['brewWeightMg'], 36400);
      await manager.unloadPlugin(manifest.id);
    },
    skip: missing && optional
        ? 'E64 simulator not found; skipped because E64_SIM_OPTIONAL=1'
        : false,
  );
}
