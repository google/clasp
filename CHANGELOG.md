# Changelog

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
