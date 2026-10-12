# Contributing

Use the issue forms to report bugs, propose features, correct catalog data, or add grinder evidence. Unknown grinder values are useful; label them unknown instead of filling gaps with assumptions.

For device work, prefer a deterministic mock or recorded, redacted trace so changes can be tested without real hardware. Separate observed measurements from research priors and owner assumptions. Link public sources and state photo/license rights.

Keep pull requests focused. Include the affected host/plugin version, tests run, and any compatibility or migration impact. Never commit secrets, credentials, private customer data, or unredacted device captures. Decaid and Streamline upstream API changes should be discussed in the linked upstream projects before implementation when practical.


## Choose where to report

| Topic | Where to start |
| --- | --- |
| A missing grinder model or variant | [Grinder form](https://github.com/MaxRink/decaid-assisted-dialin-plugin/issues/new?template=new-grinder.yml) |
| Website, dial-in plugin, collector or dashboards | [Bug form](https://github.com/MaxRink/decaid-assisted-dialin-plugin/issues/new?template=bug-report.yml) |
| Algorithm, calibration or source evidence | [Source correction](https://github.com/MaxRink/decaid-assisted-dialin-plugin/issues/new?template=source-correction.yml) |
| Coffee catalog facts | [Catalog correction](https://github.com/MaxRink/decaid-assisted-dialin-plugin/issues/new?template=coffee-catalog-correction.yml) |
| An improvement or integration proposal | [Feature form](https://github.com/MaxRink/decaid-assisted-dialin-plugin/issues/new?template=feature-request.yml) |
| Skale device/Bluetooth behavior | [Skale issues](https://github.com/MaxRink/decaid-skale-plugin/issues/new/choose) |
| E64 WS connection, protocol or grinder mock | [E64 WS issues](https://github.com/MaxRink/decaid-e64ws-plugin/issues/new/choose) |
| Recovered E64 firmware implementation | [Research issues](https://github.com/MaxRink/mahlkoenig-e64ws-local-research/issues/new/choose) |
| Host beans, shot capture or device APIs | [Decaid issues](https://github.com/decentespresso/decaid/issues) and [discussions](https://github.com/decentespresso/decaid/discussions) |
| Streamline navigation or skin integration | [Streamline issues](https://github.com/decentespresso/streamline-js/issues) |
| A security vulnerability | [Private report](https://github.com/MaxRink/decaid-e64ws-plugin/security/advisories/new) |

The plugin and [website](https://maxrink.github.io/decaid-assisted-dialin-plugin/simulator/) link to these forms through Help. Opening a form does not submit a report or attach your saved coffee/grinder data. GitHub issues are public; review what you attach.

For a new grinder, its model is enough to begin. Burrs, units, direction, repeatable step and sources are optional when unknown. Photos of the adjustment dial are useful when you own the image or can identify a reusable license. Do not force burr contact or lock to obtain a zero; follow the grinder's adjustment instructions. A model request is reviewed before it becomes a catalog entry. Your individual grinder/burr/zero settings remain separate from model-level defaults.
