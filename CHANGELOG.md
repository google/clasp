# Changelog

## [3.0.3-alpha](https://github.com/google/clasp/compare/v3.0.2-alpha...v3.0.3-alpha) (2025-03-21)


### Bug Fixes

* Correctly ignore errors fetching userinfo when logging in with custom creds. ([#1040](https://github.com/google/clasp/issues/1040)) ([6c894f2](https://github.com/google/clasp/commit/6c894f210f96d07a6992a997ddc21e93b0e3b387))
* Ensure parent ID is saved in .clasp.json ([e2e902c](https://github.com/google/clasp/commit/e2e902c9335cc13859bda81ab7248b9331df4a81))
* Fix duplicate output of some error messages ([82e921f](https://github.com/google/clasp/commit/82e921fb4f28d71002a77cd617a5a1e72eadb69b))
* Remove other instance of .claspignore file warning as now obsolete ([0b29163](https://github.com/google/clasp/commit/0b291637b2bb26ddf00094d6773bd100c4a59ae8))
* Skip micromatch when ignore file is empty ([#1043](https://github.com/google/clasp/issues/1043)) ([121dd26](https://github.com/google/clasp/commit/121dd260a7539cf3d51a406b6752dec9e5ff0beb))
* Update documentation on how to accomodate policy restrictions on 3P apps ([#940](https://github.com/google/clasp/issues/940)) ([e35cb84](https://github.com/google/clasp/commit/e35cb84098da4658b91ad934bca5810a3f4a242e))
* Update run instructions for 3.x ([f75059e](https://github.com/google/clasp/commit/f75059e83df85ba043a299393a4d5611e0c77eb5))

## [3.0.2-alpha](https://github.com/google/clasp/compare/v3.0.1-alpha1...v3.0.2-alpha) (2025-03-14)


### Features

* Add file extension settings for HTML ([e4dd863](https://github.com/google/clasp/commit/e4dd863de347e3f1747d7aff283432e9f8eb4697))
* Display logs in local time ([8952aff](https://github.com/google/clasp/commit/8952aff81abc986788c1e4daca8c416ee3813d7f))
* Move pdate deployment into a separate command ([#752](https://github.com/google/clasp/issues/752)) ([e4dd025](https://github.com/google/clasp/commit/e4dd025377b8961dfbd8ce5170112563d40f5ff1))


### Bug Fixes

* Clarify filePushOrder behavior ([eea22cb](https://github.com/google/clasp/commit/eea22cba387fd92e571d7c1ebe322be1c360972a))
* Fix create-script command/alias names ([55a33c6](https://github.com/google/clasp/commit/55a33c6a4780172c16ff8ee7316631787c9f13e5))
* Suppress punycode deprecation warning temporarily until dependencies updated ([ec352e5](https://github.com/google/clasp/commit/ec352e57c3184a23dd203f1468f7ecbfa820cc98))
* Tighten result check on run to correctly output falsy values [#770](https://github.com/google/clasp/issues/770) ([0a3947b](https://github.com/google/clasp/commit/0a3947ba6a6f14cfcbf7f8693949044064eb2738))
* Update run instructions to correct oauth client type ([#997](https://github.com/google/clasp/issues/997)) ([55793c9](https://github.com/google/clasp/commit/55793c9b2eaf762ac93283c64b032ab84efb1c5d))


### Miscellaneous Chores

* Release 3.0.2-alpha ([e820d08](https://github.com/google/clasp/commit/e820d08667787a4a8dae2cc8a514b886a31195fc))

## [3.0.1-alpha1](https://github.com/google/clasp/compare/v3.0.0-alpha1...v3.0.1-alpha1) (2025-03-11)


### Bug Fixes

* Add missing import from "open", not caught by typescript due to being browser api ([907d80f](https://github.com/google/clasp/commit/907d80f9e5d81dde387c783a86553134bf219a64))

## [3.0.0-alpha1](https://github.com/google/clasp/compare/v3.0.0-alpha...v3.0.0-alpha1) (2025-03-11)


### Miscellaneous Chores

* Release 3.0.0-alpha1 ([483a075](https://github.com/google/clasp/commit/483a0755a6d66125e0efa59bac2d3e9cb12f5a7b))

## [3.0.0-alpha](https://github.com/google/clasp/compare/v2.5.0...v3.0.0-alpha) (2025-03-11)

### ⚠ BREAKING CHANGES

* CLI syntax changed for some commands. Flattens the command structure so it is consistent.
* Typescript is no longer transpiled by clasp. Use Typescript + Rollup or another bundler to transpile code before pushing.

### Features

* Added `--user` option to allow easy switching between authorized users.

### Bug Fixes

* Don't write files on clone if unable to fetch proejct ([#824](https://github.com/google/clasp/issues/824)) ([5f7e06f](https://github.com/google/clasp/commit/5f7e06f565d11852108d330c03dada28895c22d7))
* Speed up directory crawling ([588d1bc](https://github.com/google/clasp/commit/588d1bc8df14568bc3dd7d331f3adde44f784f9e))
* Fix `--no-localhost` option during authorization

## [2.5.0](https://github.com/google/clasp/compare/v2.4.2...v2.5.0) (2025-01-09)


### Features

* Add support for custom redirect port in clasp login ([#1020](https://github.com/google/clasp/issues/1020)) ([d55832e](https://github.com/google/clasp/commit/d55832e59d63c480ae591f7d1ecba457ebfafb7b))


### Bug Fixes

* Don't write files on clone if unable to fetch project ([#824](https://github.com/google/clasp/issues/824)) ([b3b292a](https://github.com/google/clasp/commit/b3b292acfcc9bb191a3f4171601b8c420c187546))
* Rethrow error so command exits with error status ([#1019](https://github.com/google/clasp/issues/1019)) ([29ac629](https://github.com/google/clasp/commit/29ac62988b970b1905fe2601828bf7dcaac47b54))

## [2.4.2](https://github.com/google/clasp/compare/v2.4.1...v2.4.2) (2022-09-26)


### Bug Fixes

* remove online check ([#936](https://github.com/google/clasp/issues/936)) ([6775d9f](https://github.com/google/clasp/commit/6775d9f674886ac11ee2a23d59cbe62dd141d97b))

### [2.4.1](https://www.github.com/google/clasp/compare/v2.4.0...v2.4.1) (2021-08-09)


### Bug Fixes

* Don't require package.json for simple commands ([#840](https://www.github.com/google/clasp/issues/840)) ([#862](https://www.github.com/google/clasp/issues/862)) ([ad5d045](https://www.github.com/google/clasp/commit/ad5d045c431f1341cf79bcf18f150f0e9d11db55))
* Fix saving credentials when refreshed. ([#863](https://www.github.com/google/clasp/issues/863)) ([48e6fa3](https://www.github.com/google/clasp/commit/48e6fa3354de635a3ea1ce089d481847b2e939e9))
* Honor --project CLI option ([#865](https://www.github.com/google/clasp/issues/865)) ([deacf03](https://github.com/google/clasp/commit/deacf03d6d2d28abd9f3a408a77b69e99b9a59bf))
* Shut down embedded server on login faster ([40e0b3d](https://github.com/google/clasp/commit/40e0b3d67c3d381d0f24d738781ed61a2622c477))


## [2.4.0](https://www.github.com/google/clasp/compare/v2.3.1...v2.4.0) (2021-06-11)


### Features

* env & option based config files ([1b68374](https://www.github.com/google/clasp/commit/1b6837480b2e22cb8728cb80b2d8cfa36381d982))


### Bug Fixes

* unnecessary code caused `help` command to crash ([3741f71](https://www.github.com/google/clasp/commit/3741f71d744a2db8c5f1304c3426b253f8e742bd))


### Miscellaneous Chores

* switch from cjs to esm ([5055865](https://www.github.com/google/clasp/commit/5055865a28e48a654ffbb3b28212e53f484f76a4))


### [2.3.2](https://www.github.com/google/clasp/compare/v2.3.0...v2.3.2) (2021-05-17)


### Miscellaneous Chores

* Republish 2.3.0 as 2.3.2 due to unintended breaking changes in 2.3.1


### [2.3.1](https://www.github.com/google/clasp/compare/v2.3.0...v2.3.1) (2021-05-11)


### Features

* env & option based config files ([1b68374](https://www.github.com/google/clasp/commit/1b6837480b2e22cb8728cb80b2d8cfa36381d982))


### Bug Fixes

* Add missing find-up dependency ([#833](https://www.github.com/google/clasp/issues/833)) ([0c9c773](https://www.github.com/google/clasp/commit/0c9c773ff800be23aba2b32a049fec186c2e8507))
* commander 6 option clash ([f2b7092](https://www.github.com/google/clasp/commit/f2b709260d4581ad5f5ac78121481824ab54f076))
* commander 6 option clash ([#816](https://www.github.com/google/clasp/issues/816)) ([517a9d8](https://www.github.com/google/clasp/commit/517a9d8ff71c89f0665ae57903111529eb8d6dd7))
* Make tests green again -- update commander version + minor adjustments. Also fix cleanup of tests to correctly restore credentials ([d526a9f](https://www.github.com/google/clasp/commit/d526a9fa9cc4975e27c3c153cad870ca3351b89b))


### Miscellaneous Chores

* Enable release-please workflow ([60b1e25](https://www.github.com/google/clasp/commit/60b1e25a343204ce6fbff9ce5a056b479d17bbe1))
* Release 2.3.1 ([4322184](https://www.github.com/google/clasp/commit/432218430e9d1506f7a09d65893b83c951c529be))
