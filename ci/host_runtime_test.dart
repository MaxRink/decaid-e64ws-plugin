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

void main() {
  test(
    'published E64 plugin runs in the Decaid JS host against a mock',
    () async {
      final pluginRoot = Platform.environment['E64_PLUGIN_ROOT'];
      expect(
        pluginRoot,
        isNotNull,
        reason: 'CI must provide E64_PLUGIN_ROOT for source attribution',
      );
      final plugin = File('$pluginRoot/plugin.js');
      final source = await plugin.readAsString();
      final servers = <HttpServer>[];
      final sockets = <WebSocket>[];
      final malformedNext = <bool>[false, false];
      final seenTokens = <String>[];
      for (final state in ['idle', 'grinding']) {
        final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        servers.add(server);
        server.listen((request) async {
          final socket = await WebSocketTransformer.upgrade(request);
          sockets.add(socket);
          final token = request.uri.queryParameters['token'];
          if (token != null) seenTokens.add(token);
          socket.listen((raw) {
            final message = jsonDecode(raw as String) as Map<String, dynamic>;
            expect(message['data'], isEmpty);
            final type = message['type'];
            final serverIndex = servers.indexOf(server);
            if (serverIndex >= 0 && malformedNext[serverIndex]) {
              malformedNext[serverIndex] = false;
              socket.add('{malformed');
              return;
            }
            final result = switch (type) {
              'RequestDriverState' => {
                'grindState': state,
                'ddValueDum': serverIndex == 0 ? 501 : 602,
                'ddSensorFailed': false,
                'fan1TachoRpm': 800,
              },
              'RequestDriverConfig' => {'model': 'E64'},
              'RequestNachineInfo' => {'firmware': 'mock-1'},
              'RequestLogMessages' => {'entries': <dynamic>[]},
              _ => {'state': 'unknown'},
            };
            socket.add(
              jsonEncode({
                'type': '${type}Result',
                'refId': message['msgId'],
                'data': result,
              }),
            );
          });
        });
      }

      final service = PluginDeviceService();
      final manager = PluginManager(
        kvStore: _Store(),
        deviceService: service,
        deviceInvocationTimeout: const Duration(seconds: 2),
      );
      addTearDown(() async {
        await manager.dispose();
        await service.dispose();
        for (final socket in sockets) await socket.close();
        for (final server in servers) await server.close(force: true);
      });

      final manifest = PluginManifest.fromJson(
        jsonDecode(await File('$pluginRoot/manifest.json').readAsString()),
      );
      await manager.loadPlugin(
        id: manifest.id,
        manifest: manifest,
        settings: {
          'InstancesJson': jsonEncode([
            {
              'id': 'idle',
              'name': 'Mock E64 idle',
              'scheme': 'ws',
              'host': '127.0.0.1',
              'port': servers[0].port,
              'pollMs': 0,
            },
            {
              'id': 'grinding',
              'name': 'Mock E64 grinding',
              'scheme': 'ws',
              'host': '127.0.0.1',
              'port': servers[1].port,
              'pollMs': 0,
            },
          ]),
          'TokensJson': jsonEncode({
            'idle': 'idle-token',
            'grinding': 'grinding-token',
          }),
        },
        jsCode: source,
      );

      final devices =
          (await service.devices
                  .where((devices) => devices.length == 2)
                  .first
                  .timeout(const Duration(seconds: 2)))
              .cast<PluginGrinder>();
      expect(devices, hasLength(2));
      for (final device in devices) await device.onConnect();
      final snapshots = await Future.wait(
        devices.map(
          (device) =>
              device.currentSnapshot.first.timeout(const Duration(seconds: 2)),
        ),
      );
      expect(
        snapshots.map((snapshot) => snapshot.state),
        containsAll([GrinderState.idle, GrinderState.grinding]),
      );
      expect(seenTokens, containsAll(['idle-token', 'grinding-token']));
      expect(
        snapshots.map((snapshot) => snapshot.observedSetting),
        containsAll(['501 ddValueDum', '602 ddValueDum']),
      );
      for (final snapshot in snapshots) {
        expect(snapshot.observedRpm, isNull);
        expect(snapshot.toJson(), isNot(contains('rpm')));
      }
      for (final device in devices) {
        expect(device.observations, {GrinderObservation.setting});
        expect(device.capabilities, isEmpty);
        await expectLater(device.setGrindSetting('500'), throwsA(anything));
        await expectLater(device.setRpm(800), throwsA(anything));
      }

      Future<Map<String, dynamic>> request(Map<String, dynamic> value) async {
        final id = 'request-${DateTime.now().microsecondsSinceEpoch}';
        final response = manager.registerPendingHttp(manifest.id, id);
        manager.dispatchEvent(manifest.id, 'httpRequest', {
          'requestId': id,
          ...value,
        });
        return await response.timeout(const Duration(seconds: 2));
      }

      final known = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'GET',
        'query': {'deviceId': devices.first.deviceId},
      });
      expect(known['status'], 200);
      expect(known['body'] as String, contains('state'));
      final knownHeaders = (known['headers'] as Map).cast<String, dynamic>();
      expect(knownHeaders['X-E64-Observation-State'], 'last-known');
      expect(knownHeaders['X-E64-Observation-Time'], isNotEmpty);

      final read = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'GET',
        'query': {'deviceId': devices.first.deviceId, 'read': 'config'},
      });
      expect(read['status'], 200);
      expect(read['body'] as String, contains('E64'));
      final readHeaders = (read['headers'] as Map).cast<String, dynamic>();
      expect(readHeaders['X-E64-Observation-State'], 'live');
      expect(readHeaders['X-E64-Observation-Time'], isNotEmpty);

      final badRead = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'GET',
        'query': {'deviceId': devices.first.deviceId, 'read': 'unknown'},
      });
      expect(badRead['status'], 400);
      final wrongMethod = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'POST',
        'query': {'deviceId': devices.first.deviceId},
      });
      expect(wrongMethod['status'], 405);
      final unknownDevice = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'GET',
        'query': {'deviceId': 'plugin:missing'},
      });
      expect(unknownDevice['status'], 404);
      for (final response in [
        known,
        read,
        badRead,
        wrongMethod,
        unknownDevice,
      ]) {
        expect(response['body'], isNot(contains('idle-token')));
        expect(response['body'], isNot(contains('grinding-token')));
      }

      malformedNext[0] = true;
      final unavailable = await request({
        'endpoint': 'e64-diagnostics',
        'method': 'GET',
        'query': {'deviceId': devices.first.deviceId, 'read': 'config'},
      });
      expect(unavailable['status'], 503);
      final unavailableHeaders = (unavailable['headers'] as Map)
          .cast<String, dynamic>();
      expect(unavailableHeaders['X-E64-Observation-State'], 'last-known');
      expect(
        unavailableHeaders['X-E64-Observation-Time'],
        readHeaders['X-E64-Observation-Time'],
      );
      await manager.unloadPlugin(manifest.id);
      expect(await service.devices.first, isEmpty);
    },
  );
}
